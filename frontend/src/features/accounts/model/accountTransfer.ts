export interface UploadFilePayload {
  name: string;
  contentBase64: string;
}

export function resolvePastedAuthFileName(parsed: Record<string, unknown>) {
  if (typeof parsed.name === 'string' && parsed.name) {
    return parsed.name.endsWith('.json') ? parsed.name : `${parsed.name}.json`;
  }
  if (typeof parsed.email === 'string' && parsed.email) {
    return `${parsed.email.split('@')[0]}-auth.json`;
  }
  return 'pasted-auth.json';
}

export function buildAccountsExportFilename(date = new Date()) {
  return `gettokens-accounts-${date.toISOString().replace(/[:.]/g, '-')}.json`;
}

export function encodeUTF8Base64(value: string) {
  return window.btoa(unescape(encodeURIComponent(value)));
}

export async function readUploadFiles(files: FileList) {
  return Promise.all(
    Array.from(files).map(
      (file) =>
        new Promise<UploadFilePayload>((resolve, reject) => {
          const reader = new FileReader();

          reader.onload = () => {
            const result = reader.result;
            if (typeof result !== 'string') {
              reject(new Error('文件读取失败'));
              return;
            }

            const marker = 'base64,';
            const base64Index = result.indexOf(marker);
            resolve({
              name: file.name,
              contentBase64: base64Index >= 0 ? result.slice(base64Index + marker.length) : result,
            });
          };

          reader.onerror = () => reject(reader.error ?? new Error('文件读取失败'));
          reader.readAsDataURL(file);
        })
    )
  );
}
