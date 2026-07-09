/* ===== GitHub Sync v1.1 =====
 *  通过 GitHub API 跨设备同步 data.json
 *  用法: GitHubSync.pull() → 从仓库拉取
 *        GitHubSync.push(data) → 推送 data.json
 *        GitHubSync.init(owner, repo, token) → 初始化
 *        GitHubSync.isReady() → 是否已配置
 *  注意: token 需要 repository 的 Contents 读写权限
 *        使用 gh-pages 分支（与 GitHub Pages 一致）
 */
const GitHubSync = (() => {
'use strict';

const CFG_KEY = 'gh_sync_config';
const STAMP_KEY = 'gh_sync_stamp';
const DATA_PATH = 'data.json';
const BRANCH = 'gh-pages'; // 与 GitHub Pages 部署分支一致

function cfg() {
  try {
    const r = localStorage.getItem(CFG_KEY);
    return r ? JSON.parse(r) : null;
  } catch { return null; }
}

function saveCfg(c) {
  localStorage.setItem(CFG_KEY, JSON.stringify(c));
}

let _busy = false;

return {

  // 获取配置
  config: cfg,

  // 是否可用
  isReady() {
    const c = cfg();
    return !!(c && c.owner && c.repo && c.token);
  },

  // 最后同步时间
  lastSync() {
    return localStorage.getItem(STAMP_KEY) || '';
  },

  // 初始化配置（自动清理 repo 里的完整 URL）
  init(owner, repo, token) {
    // 如果填了完整 URL，自动提取仓库名
    if (repo && repo.indexOf('github.com') !== -1) {
      var parts = repo.replace(/https?:\/\/github\.com\//, '').replace(/\.git$/, '').split('/');
      owner = parts[0];
      repo = parts[1];
    }
    saveCfg({ owner, repo, token });
  },

  // 断开连接
  disconnect() {
    localStorage.removeItem(CFG_KEY);
    localStorage.removeItem(STAMP_KEY);
  },

  // 拉取 data.json 的 SHA（用于更新时传参）
  _getSha: async function() {
    const c = cfg();
    if (!c) return null;
    const url = `https://api.github.com/repos/${c.owner}/${c.repo}/contents/${DATA_PATH}?ref=${BRANCH}`;
    const res = await fetch(url, {
      headers: { 'Authorization': 'token ' + c.token, 'Accept': 'application/vnd.github.v3+json' }
    });
    if (res.status === 404) return null; // 文件还不存在
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || '获取 SHA 失败: ' + res.status);
    }
    const data = await res.json();
    return data.sha || null;
  },

  // 从 GitHub 拉取 data.json（返回解析后的对象）
  pull: async function() {
    const c = cfg();
    if (!c) throw new Error('GitHub 同步未配置');
    const url = `https://raw.githubusercontent.com/${c.owner}/${c.repo}/${BRANCH}/${DATA_PATH}`;
    const res = await fetch(url, { cache: 'no-cache' });
    if (res.status === 404) return null; // 还没有 data.json
    if (!res.ok) throw new Error('拉取失败: ' + res.status);
    return await res.json();
  },

  // 推送 data.json 到 GitHub
  push: async function(jsonData) {
    if (_busy) throw new Error('正在同步中，请稍后');
    _busy = true;
    try {
      const c = cfg();
      if (!c) throw new Error('GitHub 同步未配置');

      const content = btoa(unescape(encodeURIComponent(JSON.stringify(jsonData, null, 2))));
      const sha = await this._getSha();

      const body = {
        message: 'sync: 跨设备同步数据 ' + new Date().toLocaleString('zh-CN'),
        content: content,
        branch: BRANCH
      };
      if (sha) body.sha = sha;

      const url = `https://api.github.com/repos/${c.owner}/${c.repo}/contents/${DATA_PATH}`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': 'token ' + c.token,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        // 显示更详细的错误信息
        var detail = err.message || '';
        if (res.status === 403) {
          detail = 'Token 没有权限，请检查是否已授予仓库访问权限和 Contents 读写权限';
        } else if (res.status === 401) {
          detail = 'Token 无效或已过期，请重新生成';
        } else if (res.status === 422) {
          detail = '数据格式错误: ' + (err.message || '');
        }
        throw new Error(detail || ('推送失败 (' + res.status + ')'));
      }

      localStorage.setItem(STAMP_KEY, new Date().toLocaleString('zh-CN'));
      return true;
    } finally {
      _busy = false;
    }
  },

  // 拉取后合并到本地数据（以云端为主，保留本地新增字段）
  merge: function(localData, cloudData) {
    if (!cloudData) return localData;

    function deepMerge(target, source) {
      const result = { ...target };
      for (const k of Object.keys(source)) {
        if (result[k] && typeof result[k] === 'object' && !Array.isArray(result[k]) && result[k] !== null &&
            source[k] && typeof source[k] === 'object' && !Array.isArray(source[k]) && source[k] !== null) {
          result[k] = deepMerge(result[k], source[k]);
        } else {
          result[k] = source[k];
        }
      }
      return result;
    }
    return deepMerge(localData, cloudData);
  }
};
})();
