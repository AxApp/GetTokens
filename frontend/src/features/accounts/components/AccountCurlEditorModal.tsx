import { useEffect, useRef, useState } from 'react';
import ModalFrame from '../../../components/ui/ModalFrame';
import type { ApiKeyConfigDraft } from '../model/accountDetailConfig';
import type { VendorCredentialField } from '../model/vendorPresets';
import { writeAccountClipboardText } from '../model/accountClipboard';

interface CurlTemplateOption {
  id: string;
  title: string;
  body: string;
  description: string;
}

const accountCurlEditorHeaderClass = 'grid gap-1';
const accountCurlEditorEyebrowClass =
  'font-mono text-[length:var(--font-size-ui-2xs)] font-semibold tracking-normal text-[var(--text-muted)]';
const accountCurlEditorTitleClass =
  'text-[length:var(--font-size-ui-lg)] font-semibold tracking-normal text-[var(--text-primary)]';
const accountCurlEditorFooterNoteClass =
  'text-[length:var(--font-size-ui-xs)] font-semibold tracking-normal text-[var(--text-muted)]';
const accountCurlEditorButtonClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-2 text-[length:var(--font-size-ui-xs)] font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--text-primary)] hover:bg-[var(--gt-surface-canvas)]';
const accountCurlEditorBodyClass =
  'grid min-h-[28rem] gap-0 bg-[var(--gt-surface-canvas)] lg:grid-cols-[minmax(0,1fr)_22rem]';
const accountCurlEditorPanelClass =
  'min-w-0 border-b border-[var(--gt-border-subtle)] p-4 lg:border-b-0 lg:border-r';
const accountCurlEditorToolbarClass =
  'mb-3 flex flex-wrap items-center justify-between gap-3';
const accountCurlEditorToggleLabelClass =
  'text-[length:var(--font-size-ui-2xs)] font-semibold tracking-normal text-[var(--text-muted)]';
const accountCurlEditorMetaClass =
  'font-mono text-[length:var(--font-size-ui-2xs)] font-semibold tracking-normal text-[var(--text-muted)]';
const accountCurlEditorTextareaClass =
  'min-h-[23rem] w-full resize-none rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-2 font-mono text-[length:var(--font-size-ui-xs)] leading-relaxed text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--text-primary)]';
const accountCurlEditorSectionLabelClass =
  'font-mono text-[length:var(--font-size-ui-2xs)] font-semibold tracking-normal text-[var(--text-muted)]';
const accountCurlEditorVariableButtonClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-2 text-left transition-colors hover:border-[var(--text-primary)] hover:bg-[var(--gt-surface-canvas)] active:scale-[0.99]';
const accountCurlEditorGuidePanelClass =
  'grid gap-2 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] p-3';
const accountCurlEditorAsideClass = 'grid content-start gap-4 p-4';
const accountCurlEditorTemplateButtonClass =
  'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-3 py-2 text-left transition-colors hover:border-[var(--text-primary)] hover:bg-[var(--gt-surface-muted)] active:scale-[0.99]';
const accountCurlEditorTemplateTitleClass =
  'font-mono text-[length:var(--font-size-ui-xs)] font-semibold tracking-normal text-[var(--text-primary)]';

export function AccountCurlEditorModal({
  title,
  value,
  enabled,
  variables,
  templates,
  placeholder,
  setupGuide,
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
  setupGuide?: string[];
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
        <div data-account-curl-editor-header className={accountCurlEditorHeaderClass}>
          <div className={accountCurlEditorEyebrowClass}>
            CURL EDITOR
          </div>
          <div className={accountCurlEditorTitleClass}>
            {title}
          </div>
        </div>
      }
      footer={
        <>
          <div className={accountCurlEditorFooterNoteClass}>
            内容已写入详情页草稿，返回后由底部保存改动统一提交。
          </div>
          <button onClick={onClose} className={accountCurlEditorButtonClass}>
            关闭
          </button>
        </>
      }
    >
      <div data-account-curl-editor-body className={accountCurlEditorBodyClass}>
        <div data-account-curl-editor-script-panel className={accountCurlEditorPanelClass}>
          <div className={accountCurlEditorToolbarClass}>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => onEnabledChange(event.target.checked)}
              />
              <span className={accountCurlEditorToggleLabelClass}>
                启用
              </span>
            </label>
            <div className={accountCurlEditorMetaClass}>
              支持 {'{{apiKey}}'} / {'{{baseUrl}}'} / {'{{prefix}}'} 及厂商变量
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
            className={accountCurlEditorTextareaClass}
            placeholder={placeholder}
            spellCheck={false}
          />
          <section className="mt-3 grid gap-2">
            <div className={accountCurlEditorSectionLabelClass}>
              DEFAULT VARIABLES
            </div>
            <div data-account-curl-editor-variable-grid className="grid gap-2 sm:grid-cols-3">
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
                    className={accountCurlEditorVariableButtonClass}
                  >
                    <div className={accountCurlEditorMetaClass}>
                      {variable.label}
                    </div>
                    <div className="mt-1 break-all font-mono text-[length:var(--font-size-ui-xs)] text-[var(--text-primary)]">
                      {variable.value || '未填写'}
                    </div>
                    <div className={`mt-2 ${accountCurlEditorMetaClass}`}>
                      {hasCursor ? '插入' : copiedToken === token ? '已复制' : '复制'}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
        <aside className={accountCurlEditorAsideClass}>
          {setupGuide?.length ? (
            <section className={accountCurlEditorGuidePanelClass}>
              <div className={accountCurlEditorSectionLabelClass}>
                获取 Cookie 指引
              </div>
              <ol className="list-decimal space-y-1 pl-4 text-[length:var(--font-size-ui-xs)] font-bold leading-relaxed text-[var(--text-primary)]">
                {setupGuide.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </section>
          ) : null}
          <section data-account-curl-editor-template-panel className="grid gap-2">
            <div className={accountCurlEditorSectionLabelClass}>
              TEMPLATES
            </div>
            <div className="grid gap-2">
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => onApplyTemplate(template.body)}
                  className={accountCurlEditorTemplateButtonClass}
                >
                  <div className={accountCurlEditorTemplateTitleClass}>
                    {template.title}
                  </div>
                  <div className={`mt-1 ${accountCurlEditorMetaClass}`}>
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

export function buildCurlVariables(draft: ApiKeyConfigDraft, vendorFields: VendorCredentialField[] = []) {
  const baseVariables = [
    { label: 'apiKey', value: maskSecret(draft.apiKey) },
    { label: 'baseUrl', value: draft.baseUrl || '{{baseUrl}}' },
    { label: 'prefix', value: draft.prefix || '{{prefix}}' },
  ];
  const vendorVariables = vendorFields
    .filter((field) => field.scope === 'curl' && field.variableName)
    .map((field) => ({
      label: field.variableName || field.id,
      value: maskSecret(readDraftCredentialField(draft, field.id)),
    }));
  return [...baseVariables, ...vendorVariables];
}

function readDraftCredentialField(draft: ApiKeyConfigDraft, fieldID: VendorCredentialField['id']) {
  if (fieldID === 'platformCookie') {
    return draft.platformCookie ?? draft.curlVariables?.platformCookie ?? '';
  }
  return draft.curlVariables?.[fieldID] ?? '';
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
