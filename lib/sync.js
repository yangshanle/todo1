/* ===== GitHub Sync v1.2 =====
 *  通过 GitHub Pages + API 跨设备同步 data.json
 *  拉取: 用 GitHub Pages URL（同源，无需 token，无 CORS）
 *  推送: 用 GitHub API（需要 token 和 Contents 读写权限）
 *  分支: gh-pages（与 GitHub Pages 部署一致）
 */
const GitHubSync = (() => {
'use strict';

const CFG_KEY = 'gh_sync_config';
const STAMP_KEY = 'gh_sync_stamp';
const DATA_FILE = 'data.json';
const BRANCH = 'gh-pages';

function cfg() {
  try {
    var r = localStorage.getItem(CFG_KEY);
    return r ? JSON.parse(r) : null;
  } catch { return null; }
}

function saveCfg(c) {
  localStorage.setItem(CFG_KEY, JSON.stringify(c));
}

var _busy = false;

function pagesUrl(owner, repo) {
  return 'https://' + owner + '.github.io/' + repo + '/' + DATA_FILE + '?_t=' + Date.now();
}

function apiUrl(owner, repo) {
  return 'https://api.github.com/repos/' + owner + '/' + repo + '/contents/' + DATA_FILE;
}

function decodeBase64(str) {
  return decodeURIComponent(escape(atob(str.replace(/\s/g, ''))));
}

return {

  config: cfg,

  isReady() {
    var c = cfg();
    return !!(c && c.owner && c.repo && c.token);
  },

  lastSync() {
    return localStorage.getItem(STAMP_KEY) || '';
  },

  // 初始化（自动处理完整 URL）
  init(owner, repo, token) {
    if (repo && repo.indexOf('github.com') !== -1) {
      var parts = repo.replace(/https?:\/\/github\.com\//, '').replace(/\.git$/, '').split('/');
      owner = parts[0];
      repo = parts[1];
    }
    saveCfg({ owner, repo, token });
  },

  disconnect() {
    localStorage.removeItem(CFG_KEY);
    localStorage.removeItem(STAMP_KEY);
  },

  // 从 GitHub Pages 拉取（配置过 token 时调用）
  pull: async function() {
    var c = cfg();
    if (!c) throw new Error('GitHub 同步未配置');
    var url = pagesUrl(c.owner, c.repo);
    var res = await fetch(url, { cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('拉取失败: ' + res.status);
    return await res.json();
  },

  // 公开拉取（无需 token，供访客使用）
  pullPublic: async function(owner, repo) {
    var url = pagesUrl(owner, repo);
    var res = await fetch(url, { cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return await res.json();
  },

  // 推送 data.json 到 GitHub（需要 token，自动重试 SHA 冲突）
  push: async function(jsonData, _retried) {
    if (_busy) throw new Error('正在同步中，请稍后');
    _busy = true;
    try {
      var c = cfg();
      if (!c) throw new Error('GitHub 同步未配置');

      var content = btoa(unescape(encodeURIComponent(JSON.stringify(jsonData, null, 2))));

      // 获取当前 SHA
      var sha = null;
      var shaRes = await fetch(apiUrl(c.owner, c.repo) + '?ref=' + BRANCH, {
        headers: { 'Authorization': 'token ' + c.token, 'Accept': 'application/vnd.github.v3+json' }
      });
      if (shaRes.status !== 404) {
        if (shaRes.ok) {
          var shaData = await shaRes.json();
          sha = shaData.sha || null;
        } else {
          var shaErr = await shaRes.json().catch(() => ({}));
          throw new Error(shaErr.message || '获取文件信息失败');
        }
      }

      var body = {
        message: 'sync: 跨设备同步数据 ' + new Date().toLocaleString('zh-CN'),
        content: content,
        branch: BRANCH
      };
      if (sha) body.sha = sha;

      var putRes = await fetch(apiUrl(c.owner, c.repo), {
        method: 'PUT',
        headers: {
          'Authorization': 'token ' + c.token,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify(body)
      });

      if (!putRes.ok) {
        var err = await putRes.json().catch(() => ({}));
        // SHA 冲突 → 重试一次
        if (putRes.status === 409 && !_retried) {
          _busy = false;
          return await this.push(jsonData, true);
        }
        var detail = err.message || '';
        if (putRes.status === 403) detail = 'Token 没有权限，请授予仓库访问和 Contents 读写权限';
        else if (putRes.status === 401) detail = 'Token 无效或已过期，请重新生成';
        else if (putRes.status === 422) detail = '数据格式错误: ' + (err.message || '');
        throw new Error(detail || ('推送失败 (' + putRes.status + ')'));
      }

      localStorage.setItem(STAMP_KEY, new Date().toLocaleString('zh-CN'));
      return true;
    } finally {
      _busy = false;
    }
  },

  // 合并数据
  merge: function(localData, cloudData) {
    if (!cloudData) return localData;
    function deepMerge(t, s) {
      var r = {};
      for (var k in t) r[k] = t[k];
      for (var k in s) {
        if (r[k] && typeof r[k] === 'object' && !Array.isArray(r[k]) && r[k] !== null &&
            s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]) && s[k] !== null) {
          r[k] = deepMerge(r[k], s[k]);
        } else {
          r[k] = s[k];
        }
      }
      return r;
    }
    return deepMerge(localData, cloudData);
  }
};
})();
