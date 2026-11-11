import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/ThemeContext";

export function Footer() {
  const { t } = useTranslation();
  const { isModern } = useTheme();

  return (
    <footer className={`mt-16 border-t transition-colors duration-300 ${
      isModern
        ? "bg-gray-950 border-gray-800 text-gray-400"
        : "bg-[#f8f9fa] border-[#e9ecef] text-gray-600"
    }`}>
      <div className="max-w-5xl mx-auto px-4 py-8 text-center">
        <div className="mb-4">
          <p className={`text-sm mb-1 ${isModern ? "text-gray-400 font-sans" : "font-mono text-gray-600"}`}>
            <strong className={isModern ? "text-gray-200" : "text-gray-800"}>Kickoff Trivia</strong>
            {" "}- {t('home.footer')}
          </p>
          <p className={`text-xs ${isModern ? "text-gray-600 font-sans" : "font-mono text-gray-400"}`}>
            © 2026 Kickoff Italia. {t('common.tuttiDiritti', 'Tutti i diritti riservati.')}
          </p>
        </div>

        <div className="flex justify-center gap-6 flex-wrap text-sm">
          <a
            href="/privacy"
            className={`font-bold transition-colors hover:underline ${
              isModern ? "text-green-400 hover:text-green-300" : "text-[#667eea] hover:text-[#5a6fd6]"
            }`}
          >
            {t('home.privacy')}
          </a>
          <span className={isModern ? "text-gray-700" : "text-gray-300"}>|</span>
          <a
            href="/cookie-policy"
            className={`font-bold transition-colors hover:underline ${
              isModern ? "text-green-400 hover:text-green-300" : "text-[#667eea] hover:text-[#5a6fd6]"
            }`}
          >
            {t('home.cookie')}
          </a>
        </div>
      </div>
    </footer>
  );
}
