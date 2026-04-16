import { useState, useCallback, useRef } from 'react';
import axios from 'axios';

type DocGenStatus = 'idle' | 'classifying' | 'generating' | 'success' | 'error';

export type DocGenTask = {
  id: string;
  file: string;
  module: string;
  status: 'pending' | 'loading' | 'done' | 'failed';
  error?: string;
};

export function useDocGenerator({ 
  llmBaseUrl, 
  llmModel, 
  llmApiKey, 
  repoUrl, 
  projectSummary 
}: {
  llmBaseUrl: string;
  llmModel: string;
  llmApiKey: string;
  repoUrl: string;
  projectSummary: string;
}) {
  const [status, setStatus] = useState<DocGenStatus>('idle');
  const [tasks, setTasks] = useState<DocGenTask[]>([]);
  const [modules, setModules] = useState<{id: string, name: string}[]>([]);
  const [globalError, setGlobalError] = useState('');
  const stopRef = useRef(false);

  const extractUsageTokens = (usage: any) => {
    if (!usage || typeof usage !== 'object') return { input: 0, output: 0 };
    let input = Math.max(Number(usage.prompt_tokens) || 0, Number(usage.input_tokens) || 0);
    let output = Math.max(Number(usage.completion_tokens) || 0, Number(usage.output_tokens) || 0);
    if (input === 0 && output === 0 && Number(usage.total_tokens) > 0) {
      input = Number(usage.total_tokens);
    }
    return { input, output };
  };

  const requestJson = async (prompt: string) => {
    const res = await axios.post('/api/llm/json', {
      prompt,
      ...(llmModel ? { model: llmModel } : {}),
      ...(llmBaseUrl ? { baseUrl: llmBaseUrl } : {}),
      ...(llmApiKey ? { apiKey: llmApiKey } : {}),
    });
    return res.data?.data ?? {};
  };

  const fetchContents = async (paths: string[]) => {
    const res = await axios.post('/api/local/content', { path: repoUrl, paths });
    return res.data?.contents || {};
  };

  const startGeneration = useCallback(async (codeFiles: string[]) => {
    if (!codeFiles || codeFiles.length === 0) {
      setGlobalError('没有找到任何代码文件');
      setStatus('error');
      return;
    }
    
    stopRef.current = false;
    setStatus('classifying');
    setGlobalError('');
    try {
      const prompt = `你是一位架构师，请将以下文件列表归类为3-8个核心模块。如果文件很少，就少点分组。
返回JSON: {"modules": [{"id": "网络", "name": "网络通信层"}], "fileModuleMap": {"src/a.ts": "网络"}}
文件列表: ${JSON.stringify(codeFiles)}
`;
      const res = await requestJson(prompt);
      if (stopRef.current) throw new Error('Stopped');
      
      const fileMap = res.fileModuleMap || {};
      const generatedModules = Array.isArray(res.modules) && res.modules.length > 0 
        ? res.modules 
        : [{id: 'Other', name: 'Other'}];
      
      const defaultModule = generatedModules[0]?.id || 'Other';
      const initialTasks = codeFiles.map(f => ({
        id: f,
        file: f,
        module: typeof fileMap[f] === 'string' ? fileMap[f] : defaultModule,
        status: 'pending'
      })) as DocGenTask[];
      
      setTasks(initialTasks);
      setModules(generatedModules);
      setStatus('generating');

      let activeCount = 0;
      let currentIndex = 0;
      const MAX_CONCURRENCY = 3;

      await new Promise<void>((resolve) => {
        const processNext = () => {
          if (stopRef.current) {
            resolve();
            return;
          }
          if (currentIndex >= initialTasks.length && activeCount === 0) {
            resolve();
            return;
          }
          while (activeCount < MAX_CONCURRENCY && currentIndex < initialTasks.length) {
            if (stopRef.current) break;
            const taskIndex = currentIndex++;
            const task = initialTasks[taskIndex];
            activeCount++;

            setTasks(prev => {
              const next = [...prev];
              next[taskIndex] = { ...next[taskIndex], status: 'loading' };
              return next;
            });

            // Make the actual call
            (async () => {
              try {
                const contentsMap = await fetchContents([task.file]);
                const fileContent = contentsMap[task.file] || '';
                if (!fileContent) throw new Error('文件为空或无法读取');

                const docPrompt = `你是一个资深程序员。请根据以下代码和项目概要，生成一份该文件的标准详细设计文档 (markdown 格式)。你需要包括文件职责、核心方法梳理、业务逻辑。
返回格式必须是 JSON: {"markdown": "# <文件的作用标题>\\n<具体内容...>"}
模块: ${task.module}
文件: ${task.file}
项目概要: ${projectSummary}
代码:
${fileContent.slice(0, 50000)}
`;
                const mdRes = await requestJson(docPrompt);
                let mdContent = mdRes.markdown || 'AI没有返回生成内容';
                
                const writeRes = await axios.post('/api/local/write', {
                  path: repoUrl,
                  moduleName: task.module,
                  file: task.file,
                  content: mdContent
                });
                
                if (!writeRes.data?.success) {
                    throw new Error(writeRes.data?.error || '写盘失败');
                }

                setTasks(prev => {
                  const next = [...prev];
                  next[taskIndex] = { ...next[taskIndex], status: 'done' };
                  return next;
                });
              } catch (e: any) {
                 setTasks(prev => {
                  const next = [...prev];
                  next[taskIndex] = { ...next[taskIndex], status: 'failed', error: e?.response?.data?.error || e?.message || '未知错误' };
                  return next;
                });
              } finally {
                activeCount--;
                processNext();
              }
            })();
          }
        };
        processNext();
      });
      
      if (!stopRef.current) setStatus('success');

    } catch (e: any) {
      if (e.message !== 'Stopped') {
        setGlobalError(e.message || 'Error occurred');
        setStatus('error');
      } else {
        setStatus('idle');
      }
    }
  }, [llmBaseUrl, llmModel, llmApiKey, repoUrl, projectSummary]);

  const stopGeneration = useCallback(() => {
    stopRef.current = true;
  }, []);
  
  const reset = useCallback(() => {
    stopRef.current = true;
    setStatus('idle');
    setTasks([]);
    setGlobalError('');
  }, []);
  
  return {
    status,
    tasks,
    modules,
    globalError,
    startGeneration,
    stopGeneration,
    reset
  };
}
