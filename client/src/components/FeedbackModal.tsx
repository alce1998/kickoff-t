import { useState } from "react";
import { X, Send } from "lucide-react";
import { Button } from "./ui/button";
import { trpc } from "../lib/trpc";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");

  const sendFeedbackMutation = trpc.feedback.send.useMutation();

  const handleSubmit = async () => {
    if (!feedback.trim()) return;

    setIsSubmitting(true);
    setSubmitStatus("idle");

    try {
      await sendFeedbackMutation.mutateAsync({ message: feedback });
      setSubmitStatus("success");
      setFeedback("");
      setTimeout(() => {
        onClose();
        setSubmitStatus("idle");
      }, 2000);
    } catch (error) {
      console.error("Errore invio feedback:", error);
      setSubmitStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-pink-600 to-pink-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">Dacci il tuo feedback</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Hai consigli o segnalazioni per migliorare il nostro sito? Faccelo sapere!"
            className="w-full h-40 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
            disabled={isSubmitting}
          />

          {/* Status Messages */}
          {submitStatus === "success" && (
            <div className="mt-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg">
              ✅ Grazie per il tuo feedback! Lo abbiamo ricevuto.
            </div>
          )}
          {submitStatus === "error" && (
            <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              ❌ Errore nell'invio. Riprova più tardi.
            </div>
          )}

          {/* Submit Button */}
          <div className="mt-6 flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={!feedback.trim() || isSubmitting}
              className="bg-pink-600 hover:bg-pink-700 text-white flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              {isSubmitting ? "Invio..." : "Invia"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
