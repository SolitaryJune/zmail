import React, { useState, useEffect } from 'react';
import { 
  fetchPresetPlatforms, 
  createPresetPlatform, 
  updatePresetPlatform, 
  deletePresetPlatform 
} from '../utils/api';

interface AccountFormProps {
  account?: Account | null;
  onSave: (data: Partial<Account>) => Promise<void>;
  onClose: () => void;
}

const AccountForm: React.FC<AccountFormProps> = ({ account, onSave, onClose }) => {
  const [title, setTitle] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [platforms, setPlatforms] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [presetPlatforms, setPresetPlatforms] = useState<{id: string; name: string}[]>([]);
  const [isPresetsLoading, setIsPresetsLoading] = useState(true);
  
  const [isAutoTitle, setIsAutoTitle] = useState(true);

  const [isAddingPreset, setIsAddingPreset] = useState(false);
  const [newPresetValue, setNewPresetValue] = useState('');
  const [editingPreset, setEditingPreset] = useState<string | null>(null);
  const [editPresetValue, setEditPresetValue] = useState('');

  // 初始化信息与自动标题状态
  useEffect(() => {
    if (account) {
      setTitle(account.title || '');
      setUsername(account.username || '');
      setEmail(account.email || '');
      setPassword(account.password || '');
      setPhone(account.phone || '');
      setPlatforms(account.platforms?.join(', ') || '');
      setNotes(account.notes || '');

      // 如果当前标题符合自动生成的 "[平台]: [账号]" 格式，保持同步
      const mainPlatform = (account.platforms?.[0] || '').trim();
      const identifier = account.email || account.username || '';
      const expectedTitle = mainPlatform && identifier ? `${mainPlatform}: ${identifier}` : (mainPlatform || identifier);
      
      if (account.title && account.title !== expectedTitle) {
        setIsAutoTitle(false);
      } else {
        setIsAutoTitle(true);
      }
    } else {
      setIsAutoTitle(true);
    }
  }, [account]);

  // 从后端加载预设
  const loadPresets = async () => {
    setIsPresetsLoading(true);
    const res = await fetchPresetPlatforms();
    if (res.success && res.presets) {
      setPresetPlatforms(res.presets);
    }
    setIsPresetsLoading(false);
  };

  useEffect(() => {
    loadPresets();
  }, []);

  // 标题联动
  useEffect(() => {
    if (isAutoTitle) {
      const activePlatforms = platforms.split(/[,，]/).map(s => s.trim()).filter(Boolean);
      const mainPlatform = activePlatforms.join(', '); // 多个平台用逗号连接
      const identifier = email || username || '';
      const newTitle = mainPlatform && identifier ? `${mainPlatform}: ${identifier}` : (mainPlatform || identifier);
      
      if (newTitle) {
        setTitle(newTitle);
      } else if (!account) {
        setTitle('');
      }
    }
  }, [platforms, email, username, isAutoTitle, account]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    setIsAutoTitle(false);
  };

  const handleTogglePlatform = (p: string) => {
    let current = platforms.split(/[,，]/).map(s => s.trim()).filter(Boolean);
    // 不区分大小写匹配，如果存在则移除，否则添加
    const pLower = p.toLowerCase();
    const existingIndex = current.findIndex(x => x.toLowerCase() === pLower);
    
    if (existingIndex >= 0) {
       current.splice(existingIndex, 1);
    } else {
       current.push(p);
    }
    setPlatforms(current.join(', '));
  };

  const handleAddPreset = async () => {
    const p = newPresetValue.trim();
    if (!p) return;
    
    // 前端防重检查
    const existingEntry = presetPlatforms.find(existing => existing.name.toLowerCase() === p.toLowerCase());
    if (existingEntry) {
       setError(`预设标签 "${p}" 已存在`);
       return;
    }

    setIsPresetsLoading(true);
    const res = await createPresetPlatform(p);
    if (!res.success) {
      setError(res.error || '添加预设失败');
    }
    await loadPresets();
    setIsAddingPreset(false);
  };

  const handleEditPresetStart = (p: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPreset(p);
    setEditPresetValue(p);
  };

  const handleEditPresetSave = async () => {
    const p = editPresetValue.trim();
    if (!p) {
      setEditingPreset(null);
      return;
    }
    
    if (p !== editingPreset) {
      const conflict = presetPlatforms.find(
        existing => existing.name.toLowerCase() === p.toLowerCase() && existing.name !== editingPreset
      );
      
      if (conflict) {
        setError(`修改失败：目标名称 "${p}" 与已有标签冲突`);
        setEditingPreset(null);
        return;
      }

      setIsPresetsLoading(true);
      const res = await updatePresetPlatform(editingPreset!, p);
      if (!res.success) {
        setError(res.error || '重命名预设失败');
      } else {
        // 更新已选中的平台
        const activePlatforms = platforms.split(/[,，]/).map(s => s.trim()).filter(Boolean);
        const updatedActive = activePlatforms.map(s => 
          s.toLowerCase() === editingPreset!.toLowerCase() ? p : s
        );
        setPlatforms(updatedActive.join(', '));
      }
      await loadPresets();
    }
    setEditingPreset(null);
  };

  const handleDeletePreset = async (p: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`确定要彻底删除预设标签 "${p}" 吗？\n删除预设不会影响历史账号中已保存的标签。`)) {
      setIsPresetsLoading(true);
      const res = await deletePresetPlatform(p);
      if (!res.success) {
        setError(res.error || '删除预设失败');
      } else {
        const activePlatforms = platforms.split(/[,，]/).map(s => s.trim()).filter(Boolean);
        const pLower = p.toLowerCase();
        
        // 从输入框的内容中同步删除
        const newActive = activePlatforms.filter(x => x.toLowerCase() !== pLower);
        if (newActive.length !== activePlatforms.length) {
          setPlatforms(newActive.join(', '));
        }
      }
      await loadPresets();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('标题不能为空');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const platformList = platforms
        .split(/[,，]/)
        .map(p => p.trim())
        .filter(p => p);
        
      // 表单输入框里的平台，手动输入的新平台，静默尝试加入云端预设
      // 通过 Promise.all 并发忽略错误的请求即可
      const newCustoms = platformList.filter(np => 
        !presetPlatforms.some(existing => existing.name.toLowerCase() === np.toLowerCase())
      );
      if (newCustoms.length > 0) {
        await Promise.allSettled(newCustoms.map(np => createPresetPlatform(np)));
        // 发送完不管成功失败，重新拉一下预设池下回展现就好
        loadPresets().catch(console.error);
      }

      await onSave({
        title: title.trim(),
        username: username.trim(),
        email: email.trim(),
        password,
        phone: phone.trim(),
        platforms: platformList,
        notes: notes.trim(),
      });
    } catch (err) {
      setError('保存失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };


  const inputClass = "w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary text-sm";
  const labelClass = "block text-sm font-medium mb-1";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card border rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold">
            {account ? '编辑账号' : '新增账号'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-3">
          <div>
            <div className="flex justify-between items-end mb-1">
              <label className="block text-sm font-medium">标题 <span className="text-red-500">*</span></label>
              {!isAutoTitle && (
                <button 
                  type="button" 
                  onClick={() => setIsAutoTitle(true)}
                  className="text-xs text-primary hover:text-primary/80"
                >
                  <i className="fas fa-sync-alt mr-1"></i>恢复自动生成
                </button>
              )}
            </div>
            <input type="text" value={title} onChange={handleTitleChange} className={inputClass} placeholder="例如：GitHub 主号" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>用户名</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} placeholder="登录用户名" />
            </div>
            <div>
              <label className={labelClass}>邮箱</label>
              <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="注册邮箱" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>密码</label>
              <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} placeholder="密码（明文）" />
            </div>
            <div>
              <label className={labelClass}>手机号</label>
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} placeholder="手机号" />
            </div>
          </div>

          <div>
            <label className={labelClass}>平台标签预设与选择</label>
            <div className="flex flex-wrap gap-2 mb-2 items-center">
              {isPresetsLoading ? (
                <div className="text-xs text-muted-foreground flex items-center gap-1 py-1">
                  <i className="fas fa-spinner fa-spin"></i> 加载预设中...
                </div>
              ) : (
                presetPlatforms.map(p => {
                  const isActive = platforms.split(/[,，]/).map(s => s.toLowerCase().trim()).includes(p.name.toLowerCase());

                  if (editingPreset === p.name) {
                    return (
                      <div key={`edit-${p.id}`} className="flex items-center gap-1 relative z-10 w-auto">
                        <input 
                          type="text" 
                          autoFocus
                          value={editPresetValue} 
                          onChange={e => setEditPresetValue(e.target.value)}
                          onBlur={handleEditPresetSave}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleEditPresetSave();
                            } else if (e.key === 'Escape') {
                              setEditingPreset(null);
                            }
                          }}
                          className="px-2 py-1 text-xs rounded border border-primary w-24 outline-none bg-background shadow-sm"
                        />
                      </div>
                    );
                  }

                  return (
                    <div key={`preset-${p.id}`} className="flex items-stretch">
                      <button
                        type="button"
                        onClick={() => handleTogglePlatform(p.name)}
                        className={`px-2.5 py-1 text-xs transition-colors flex items-center justify-center 
                          ${
                            isActive 
                              ? 'bg-primary text-primary-foreground border-primary pb-[5px] pt-[5px]' 
                              : 'bg-muted/50 border-muted hover:bg-muted text-foreground pb-[5px] pt-[5px]'
                          } 
                          border rounded-l border-r-0
                        `}
                      >
                        {p.name}
                      </button>
                      <div className={`flex items-center border border-l-0 rounded-r px-1 gap-1 transition-colors
                          ${
                            isActive
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-muted/50 border-muted hover:bg-muted text-foreground'
                          }
                      `}>
                        <button
                          type="button"
                          onClick={(e) => handleEditPresetStart(p.name, e)}
                          className="hover:text-amber-500 flex items-center justify-center w-4 h-4 rounded"
                          title="编辑预设"
                        >
                          <i className="fas fa-edit text-[10px]"></i>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeletePreset(p.name, e)}
                          className="hover:text-red-500 flex items-center justify-center w-4 h-4 rounded"
                          title="删除预设"
                        >
                          <i className="fas fa-times text-[10px]"></i>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}

              <div className="flex items-center ml-1">
                {isAddingPreset ? (
                  <input 
                    type="text" 
                    autoFocus
                    value={newPresetValue}
                    onChange={e => setNewPresetValue(e.target.value)}
                    onBlur={() => { handleAddPreset(); setIsAddingPreset(false); }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddPreset();
                        setIsAddingPreset(false);
                      } else if (e.key === 'Escape') {
                        setIsAddingPreset(false);
                      }
                    }}
                    className="px-2 py-1 text-xs rounded border border-primary w-24 outline-none bg-background shadow-sm"
                    placeholder="新标签..."
                  />
                ) : (
                  <button 
                    type="button"
                    onClick={() => { setIsAddingPreset(true); setNewPresetValue(''); }}
                    className="px-2 py-1 text-xs rounded border border-dashed border-muted-foreground/50 text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center gap-1"
                  >
                    <i className="fas fa-plus text-[10px]"></i> 添加
                  </button>
                )}
              </div>
            </div>
            
            <input 
              type="text" 
              value={platforms} 
              onChange={(e) => setPlatforms(e.target.value)} 
              className={inputClass} 
              placeholder="实际选中的预设列表（也可直接输入，逗号分隔）" 
            />
          </div>

          <div>
            <label className={labelClass}>备注</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputClass} resize-none`} rows={3} placeholder="额外备注信息" />
          </div>

          {error && (
            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded-md">{error}</div>
          )}
        </form>

        <div className="flex justify-end gap-2 p-4 border-t">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md bg-muted hover:bg-muted/80" disabled={isLoading}>
            取消
          </button>
          <button onClick={handleSubmit} className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90" disabled={isLoading}>
            {isLoading ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccountForm;
