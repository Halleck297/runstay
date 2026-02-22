import { useI18n } from "~/hooks/useI18n";

interface LocalePersistPromptProps {
  open: boolean;
  languageLabel: string;
  className?: string;
  onClose: () => void;
  onKeepTemporary: () => void;
  onMakeDefault: () => void;
}

export function LocalePersistPrompt({
  open,
  languageLabel,
  className,
  onClose,
  onKeepTemporary,
  onMakeDefault,
}: LocalePersistPromptProps) {
  const { t } = useI18n();
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      className={`absolute top-full mt-2 w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-lg ${className ?? "left-0 z-40"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-sm font-semibold text-gray-900">{t("settings.locale_prompt.title")}</h3>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          aria-label={t("settings.locale_prompt.close")}
        >
          <span aria-hidden>×</span>
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-600">{t("settings.locale_prompt.body")}</p>
      <p className="mt-1 text-xs font-semibold text-gray-900">{languageLabel}</p>
      <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onKeepTemporary}
            className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            {t("settings.locale_prompt.keep_temporary")}
          </button>
          <button
            type="button"
            onClick={onMakeDefault}
            className="rounded-full bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700"
          >
            {t("settings.locale_prompt.save_default")}
          </button>
      </div>
    </div>
  );
}
