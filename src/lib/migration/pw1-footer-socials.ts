type Row = Record<string, unknown>;
const supportedHosts: Record<string, string> = {
  'facebook.com': 'facebook', 'instagram.com': 'instagram', 'twitter.com': 'twitter', 'x.com': 'twitter',
  'linkedin.com': 'linkedin', 'youtube.com': 'youtube', 'youtu.be': 'youtube', 'tiktok.com': 'tiktok',
};
/** PW1 footer hyperlink_icon stores items as flattened model_settings keys. */
export function extractFooterSocials(lines: Row[], warn: (message: string) => void): Array<{platform:string;url:string}> {
  const result: Array<{platform:string;url:string}> = [];
  for (const line of lines) {
    const kind = line.menu_line_type && typeof line.menu_line_type === 'object' ? (line.menu_line_type as Row).name : undefined;
    if (kind !== 'hyperlink_icon' && String(line.type_id) !== '3') continue;
    const settings = Array.isArray(line.model_settings) ? line.model_settings as Row[] : [];
    const entries = settings.filter(row => !row.deleted_at && (row.status == null || String(row.status) === '1'));
    const urls = entries.filter(row => /^items\.\d+\.url$/.test(String(row.key))).sort((a,b) => Number(String(a.key).split('.')[1])-Number(String(b.key).split('.')[1]));
    for (const row of urls) {
      const value = typeof row.value === 'string' ? row.value.trim() : '';
      if (!value) continue;
      let url: URL;
      try { url = new URL(value); } catch { warn(`menu-line:${line.id}: invalid footer social URL`); continue; }
      if (!['http:','https:'].includes(url.protocol) || url.username || url.password) { warn(`menu-line:${line.id}: unsafe footer social URL`); continue; }
      const platform = supportedHosts[url.hostname.toLowerCase().replace(/^(www\.|m\.)/, '')];
      if (!platform) { warn(`menu-line:${line.id}: unsupported footer icon link ${url.hostname}`); continue; }
      if (!result.some(item => item.platform === platform && item.url === value)) result.push({platform,url:value});
    }
  }
  return result;
}
