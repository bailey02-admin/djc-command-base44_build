import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, X, AlertCircle, Send } from "lucide-react";

function RatingInput({ value, onChange }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {[1,2,3,4,5,6,7,8,9,10].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`w-9 h-9 rounded-lg text-sm font-semibold border transition-colors ${
            value === n
              ? n >= 8 ? "bg-emerald-100 border-emerald-400 text-emerald-700"
                : n >= 6 ? "bg-amber-100 border-amber-400 text-amber-700"
                : "bg-red-100 border-red-400 text-red-700"
              : "bg-white border-gray-200 text-gray-500 hover:border-gray-400"
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export default function StaffSurveyModal({ event, template, onClose, onSubmitted }) {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loadingQs, setLoadingQs] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    base44.functions.invoke("getSurveyTemplateDetail", { template_id: template.id })
      .then(res => {
        const qs = res.data?.questions || [];
        setQuestions(qs);
        // Init answers
        const initAnswers = {};
        for (const q of qs) {
          initAnswers[q.id] = { question_id: q.id };
        }
        setAnswers(initAnswers);
      })
      .finally(() => setLoadingQs(false));
  }, [template.id]);

  const updateAnswer = (questionId, field, value) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { ...prev[questionId], question_id: questionId, [field]: value },
    }));
  };

  const handleSubmit = async () => {
    setError(null);
    // Validate required
    for (const q of questions) {
      if (q.is_required) {
        const ans = answers[q.id] || {};
        if (q.question_type === "rating_1_10" && ans.rating_value == null) {
          setError(`Please answer: "${q.question_text}"`); return;
        }
        if (q.question_type === "yes_no" && ans.boolean_value == null) {
          setError(`Please answer: "${q.question_text}"`); return;
        }
        if (q.question_type === "text" && (!ans.text_value || !ans.text_value.trim())) {
          setError(`Please answer: "${q.question_text}"`); return;
        }
      }
    }

    setSubmitting(true);
    try {
      await base44.functions.invoke("submitSurveyResponse", {
        event_id: event.id,
        template_id: template.id,
        answers: Object.values(answers),
      });
      onSubmitted();
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-semibold text-gray-900">{template.name}</h2>
            <p className="text-xs text-gray-400">{event.event_name} — Staff Survey Entry</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          {loadingQs ? (
            <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading questions…
            </div>
          ) : questions.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">No questions in this template.</p>
          ) : (
            questions.map((q, i) => (
              <div key={q.id} className="space-y-2.5">
                <div className="flex items-start gap-2">
                  <span className="text-xs font-semibold text-gray-400 mt-0.5 w-5 flex-shrink-0">Q{i+1}</span>
                  <div className="flex-1 space-y-2">
                    <p className="text-sm font-medium text-gray-900">
                      {q.question_text}
                      {q.is_required && <span className="text-red-400 ml-0.5">*</span>}
                      {q.category && <span className="ml-2 text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{q.category}</span>}
                    </p>

                    {q.question_type === "rating_1_10" && (
                      <RatingInput
                        value={answers[q.id]?.rating_value}
                        onChange={v => updateAnswer(q.id, "rating_value", v)}
                      />
                    )}

                    {q.question_type === "yes_no" && (
                      <div className="flex gap-3">
                        {[true, false].map(v => (
                          <button
                            key={String(v)}
                            type="button"
                            onClick={() => updateAnswer(q.id, "boolean_value", v)}
                            className={`px-5 py-2 rounded-lg text-sm font-medium border transition-colors ${
                              answers[q.id]?.boolean_value === v
                                ? v ? "bg-emerald-100 border-emerald-400 text-emerald-700" : "bg-red-100 border-red-400 text-red-700"
                                : "bg-white border-gray-200 text-gray-500 hover:border-gray-400"
                            }`}
                          >
                            {v ? "Yes" : "No"}
                          </button>
                        ))}
                      </div>
                    )}

                    {q.question_type === "text" && (
                      <Textarea
                        value={answers[q.id]?.text_value || ""}
                        onChange={e => updateAnswer(q.id, "text_value", e.target.value)}
                        placeholder="Type your response…"
                        className="h-20 resize-none text-sm"
                      />
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-5 py-4 border-t flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || loadingQs}
            className="flex-1 bg-violet-600 hover:bg-violet-700 gap-1.5"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit Survey
          </Button>
        </div>
      </div>
    </div>
  );
}