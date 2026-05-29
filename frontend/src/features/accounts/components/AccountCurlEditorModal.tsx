import { useEffect, useRef, useState } from 'react';
import ModalFrame from '../../../components/ui/ModalFrame';
import type { ApiKeyConfigDraft } from '../model/accountDetailConfig';
import { writeAccountClipboardText } from '../model/accountClipboard';

interface CurlTemplateOption {
  id: string;
  title: string;
  body: string;
  description: string;
}

export function AccountCurlEditorModal({
  title,
  value,
  enabled,
  variables,
  templates,
  placeholder,
  onValueChange,
  onEnabledChange,
  onApplyTemplate,
  onClose,
}: {
  title: string;
  value: string;
  enabled: boolean;
  variables: Array<{ label: string; value: string }>;
  templates: CurlTemplateOption[];
  placeholder: string;
  onValueChange: (value: string) => void;
  onEnabledChange: (enabled: boolean) => void;
  onApplyTemplate: (template: string) => void;
  onClose: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const cursorRangeRef = useRef<{ start: number; end: number } | null>(null);
  const copiedTokenTimerRef = useRef<number | null>(null);
  const [hasCursor, setHasCursor] = useState(false);
  const [copiedToken, setCopiedToken] = useState('');

  useEffect(() => {
    return () => {
      if (copiedTokenTimerRef.current !== null) {
        window.clearTimeout(copiedTokenTimerRef.current);
      }
    };
  }, []);

  function rememberCursor() {
    const textarea = textareaRef.current;
    if (!textarea) {
      cursorRangeRef.current = null;
      setHasCursor(false);
      return;
    }
    cursorRangeRef.current = {
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    };
    setHasCursor(true);
  }

  function handleTextareaBlur() {
    setHasCursor(false);
  }

  function resetCopiedTokenAfterDelay() {
    if (copiedTokenTimerRef.current !== null) {
      window.clearTimeout(copiedTokenTimerRef.current);
    }
    copiedTokenTimerRef.current = window.setTimeout(() => {
      setCopiedToken('');
      copiedTokenTimerRef.current = null;
    }, 1500);
  }

  async function insertOrCopyVariable(label: string) {
    const token = `{{${label}}}`;
    const range = hasCursor ? cursorRangeRef.current : null;
    if (!range) {
      try {
        await writeAccountClipboardText(token);
        setCopiedToken(token);
        resetCopiedTokenAfterDelay();
      } catch {
        setCopiedToken('');
      }
      return;
    }

    const nextValue = `${value.slice(0, range.start)}${token}${value.slice(range.end)}`;
    const nextCursor = range.start + token.length;
    onValueChange(nextValue);
    cursorRangeRef.current = { start: nextCursor, end: nextCursor };
    setCopiedToken('');
    window.setTimeout(() => {
      const textarea = textareaRef.current;
      if (!textarea) {
        return;
      }
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
      setHasCursor(true);
    }, 0);
  }

  return (
    <ModalFrame
      onClose={onClose}
      size="xl"
      header={
        <div className="space-y-1">
          <div className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
            CURL EDITOR
          </div>
          <div className="text-lg font-black uppercase italic tracking-tight text-[var(--text-primary)]">
            {title}
          </div>
        </div>
      }
      footer={
        <>
          <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.08em] text-[var(--text-muted)]">
            内容已写入详情页草稿，返回后由底部保存改动统一提交。
          </div>
          <button onClick={onClose} className="btn-swiss text-[length:var(--font-size-ui-xs)]">
            关闭
          </button>
        </>
      }
    >
      <div className="grid min-h-[28rem] gap-0 bg-[var(--bg-main)] lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 border-b-2 border-[var(--border-color)] p-4 lg:border-b-0 lg:border-r-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => onEnabledChange(event.target.checked)}
              />
              <span className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                启用
              </span>
            </label>
            <div className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
              支持 {'{{apiKey}}'} / {'{{baseUrl}}'} / {'{{prefix}}'}
            </div>
          </div>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            onBlur={handleTextareaBlur}
            onClick={rememberCursor}
            onFocus={rememberCursor}
            onKeyUp={rememberCursor}
            onSelect={rememberCursor}
            className="input-swiss min-h-[23rem] w-full resize-none font-mono !text-[length:var(--font-size-ui-xs)] leading-relaxed"
            placeholder={placeholder}
            spellCheck={false}
          />
          <section className="mt-3 grid gap-2">
            <div className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
              DEFAULT VARIABLES
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {variables.map((variable) => {
                const token = `{{${variable.label}}}`;
                return (
                  <button
                    key={variable.label}
                    type="button"
                    onMouseDown={(event) => {
                      if (hasCursor) {
                        event.preventDefault();
                      }
                    }}
                    onClick={() => void insertOrCopyVariable(variable.label)}
                    className="border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-left hover:bg-[var(--bg-main)] active:scale-[0.99]"
                  >
                    <div className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      {variable.label}
                    </div>
                    <div className="mt-1 break-all font-mono text-[length:var(--font-size-ui-xs)] text-[var(--text-primary)]">
                      {variable.value || '未填写'}
                    </div>
                    <div className="mt-2 font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
                      {hasCursor ? '插入' : copiedToken === token ? '已复制' : '复制'}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
        <aside className="grid content-start gap-4 p-4">
          <section className="grid gap-2">
            <div className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
              TEMPLATES
            </div>
            <div className="grid gap-2">
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => onApplyTemplate(template.body)}
                  className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2 text-left hover:bg-[var(--bg-surface)] active:scale-[0.99]"
                >
                  <div className="font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.08em] text-[var(--text-primary)]">
                    {template.title}
                  </div>
                  <div className="mt-1 font-mono text-[length:var(--font-size-ui-2xs)] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    {template.description}
                  </div>
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </ModalFrame>
  );
}

export function buildCurlVariables(draft: ApiKeyConfigDraft) {
  return [
    { label: 'apiKey', value: maskSecret(draft.apiKey) },
    { label: 'baseUrl', value: draft.baseUrl || '{{baseUrl}}' },
    { label: 'prefix', value: draft.prefix || '{{prefix}}' },
  ];
}

export function buildQuotaCurlTemplates(baseUrl: string, vendorTemplate: string): CurlTemplateOption[] {
  const normalizedBaseURL = baseUrl || '{{baseUrl}}';
  return [
    ...(vendorTemplate ? [{
      id: 'vendor',
      title: '供应商默认',
      description: '使用当前供应商预设的额度接口',
      body: vendorTemplate,
    }] : []),
    {
      id: 'usage',
      title: 'Usage Endpoint',
      description: '通用 usage JSON 接口',
      body: `curl -sS "${normalizedBaseURL}/usage" -H "Authorization: Bearer {{apiKey}}"`,
    },
    {
      id: 'limits',
      title: 'Limits Endpoint',
      description: '通用 limits JSON 接口',
      body: `curl -sS "${normalizedBaseURL}/limits" -H "Authorization: Bearer {{apiKey}}"`,
    },
  ];
}

export function buildBillingCurlTemplates(baseUrl: string, vendorTemplate: string): CurlTemplateOption[] {
  const normalizedBaseURL = baseUrl || '{{baseUrl}}';
  return [
    ...(vendorTemplate ? [{
      id: 'vendor',
      title: '供应商默认',
      description: '使用当前供应商预设的余额接口',
      body: vendorTemplate,
    }] : []),
    {
      id: 'billing',
      title: 'Billing Endpoint',
      description: '通用 billing JSON 接口',
      body: `curl -sS "${normalizedBaseURL}/billing" -H "Authorization: Bearer {{apiKey}}"`,
    },
    {
      id: 'credits',
      title: 'Credits Endpoint',
      description: '常见 credit grants 查询',
      body: `curl -sS "${normalizedBaseURL}/dashboard/billing/credit_grants" -H "Authorization: Bearer {{apiKey}}"`,
    },
  ];
}

function maskSecret(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '{{apiKey}}';
  }
  if (trimmed.length <= 8) {
    return '****';
  }
  return `${trimmed.slice(0, 4)}****${trimmed.slice(-4)}`;
}
