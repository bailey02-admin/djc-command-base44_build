import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown,
  Save, Loader2, AlertCircle, GripVertical
} from "lucide-react";

const EVENT_TYPES = [
  "wedding","corporate","school_dance","private_party","birthday",
  "anniversary","mitzvah","quinceañera","holiday_party","other"
];
const CITIES = ["TUL","DFW","HOU","SAT","KC","STL","INDY","NASH","DEN","ATL"];
const QUESTION_TYPES = [
  { value: "rating_1_10", label: "Rating (1–10)" },
  { value: "yes_no", label: "Yes / No" },
  { value: "text", label: "Open Text" },
];

const defaultQuestion = () => ({
  _key: Math.random().toString(36).slice(2),
  question_text: "",
  question_type: "rating_1_10",
  is_required: true,
  category: "",
  weight: 1,
});

export default function SurveyTemplateBuilder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = new URLSearchParams(window.location.search);
  const templateId = params.get("id");
  const isEdit = !!templateId;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [template, setTemplate] = useState({
    name: "",
    description: "",
    is_active: true,
    applies_to_event_types: [],
    applies_to_cities: [],
    low_score_threshold: 7.0,
    send_automatically: false,
  });
  const [questions, setQuestions] = useState([defaultQuestion()]);

  useEffect(() => {
    if (!isEdit) return;
    base44.functions.invoke("getSurveyTemplateDetail", { template_id: templateId })
      .then(res => {
        const { template: t, questions: qs } = res.data;
        setTemplate({
          id: t.id,
          name: t.name || "",
          description: t.description || "",
          is_active: t.is_active !== false,
          applies_to_event_types: t.applies_to_event_types || [],
          applies_to_cities: t.applies_to_cities || [],
          low_score_threshold: t.low_score_threshold ?? 7.0,
          send_automatically: t.send_automatically || false,
        });
        if (qs && qs.length > 0) {
          setQuestions(qs.map(q => ({ ...q, _key: q.id || Math.random().toString(36).slice(2) })));
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [templateId]);

  const toggleArrayItem = (field, val) => {
    setTemplate(prev => {
      const arr = prev[field] || [];
      return {
        ...prev,
        [field]: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val],
      };
    });
  };

  const addQuestion = () => setQuestions(prev => [...prev, defaultQuestion()]);

  const removeQuestion = (key) => setQuestions(prev => prev.filter(q => q._key !== key));

  const updateQuestion = (key, field, value) => {
    setQuestions(prev => prev.map(q => q._key === key ? { ...q, [field]: value } : q));
  };

  const moveQuestion = (key, dir) => {
    setQuestions(prev => {
      const idx = prev.findIndex(q => q._key === key);
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  };

  const handleSave = async () => {
    if (!template.name.trim()) { setError("Template name is required."); return; }
    if (questions.length === 0) { setError("Add at least one question."); return; }
    for (const q of questions) {
      if (!q.question_text.trim()) { setError("All questions must have question text."); return; }
    }
    setError(null);
    setSaving(true);
    try {
      const res = await base44.functions.invoke("saveSurveyTemplate", {
        action: isEdit ? "update" : "create",
        template,
        questions: questions.map((q, i) => ({
          ...q,
          sort_order: i,
          _key: undefined,
        })),
      });
      queryClient.invalidateQueries(["survey-templates"]);
      navigate(createPageUrl("SurveyTemplates"));
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
    </div>
  );

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link to={createPageUrl("SurveyTemplates")} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-bold text-gray-900">
          {isEdit ? "Edit Survey Template" : "New Survey Template"}
        </h1>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Template Settings */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700">Template Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Template Name *</Label>
              <Input
                value={template.name}
                onChange={e => setTemplate(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Wedding Post-Event Survey"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Low Score Threshold</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number" min={1} max={10} step={0.5}
                  value={template.low_score_threshold}
                  onChange={e => setTemplate(p => ({ ...p, low_score_threshold: parseFloat(e.target.value) }))}
                  className="w-24"
                />
                <span className="text-xs text-gray-500">/ 10 — triggers low-score alert</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={template.description}
              onChange={e => setTemplate(p => ({ ...p, description: e.target.value }))}
              placeholder="Optional description…"
              className="h-20 resize-none"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Applies to Event Types</Label>
              <div className="flex flex-wrap gap-2">
                {EVENT_TYPES.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleArrayItem("applies_to_event_types", t)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      template.applies_to_event_types?.includes(t)
                        ? "bg-violet-100 border-violet-300 text-violet-700"
                        : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    {t.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-400">Leave empty to apply to all event types</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Applies to Cities</Label>
              <div className="flex flex-wrap gap-2">
                {CITIES.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleArrayItem("applies_to_cities", c)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      template.applies_to_cities?.includes(c)
                        ? "bg-indigo-100 border-indigo-300 text-indigo-700"
                        : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-400">Leave empty to apply to all cities</p>
            </div>
          </div>

          <div className="flex items-center gap-6 pt-1">
            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={template.is_active}
                onCheckedChange={v => setTemplate(p => ({ ...p, is_active: v }))}
              />
              <Label htmlFor="is_active" className="cursor-pointer text-sm">Active</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="send_auto"
                checked={template.send_automatically}
                onCheckedChange={v => setTemplate(p => ({ ...p, send_automatically: v }))}
              />
              <Label htmlFor="send_auto" className="cursor-pointer text-sm">Auto-send on completion</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Questions */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-gray-700">Questions ({questions.length})</CardTitle>
          <Button variant="outline" size="sm" onClick={addQuestion} className="gap-1 text-xs">
            <Plus className="w-3.5 h-3.5" /> Add Question
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {questions.map((q, idx) => (
            <div key={q._key} className="border border-gray-100 rounded-xl p-4 bg-gray-50/60 space-y-3">
              <div className="flex items-start gap-2">
                <div className="flex flex-col gap-0.5 pt-1 text-gray-300">
                  <GripVertical className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-gray-400 uppercase">Q{idx + 1}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost" size="icon"
                        className="w-6 h-6"
                        onClick={() => moveQuestion(q._key, -1)}
                        disabled={idx === 0}
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="w-6 h-6"
                        onClick={() => moveQuestion(q._key, 1)}
                        disabled={idx === questions.length - 1}
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="w-6 h-6 text-red-400 hover:text-red-600"
                        onClick={() => removeQuestion(q._key)}
                        disabled={questions.length === 1}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  <Input
                    value={q.question_text}
                    onChange={e => updateQuestion(q._key, "question_text", e.target.value)}
                    placeholder="Question text…"
                    className="bg-white"
                  />

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[10px] text-gray-400 uppercase">Type</Label>
                      <Select value={q.question_type} onValueChange={v => updateQuestion(q._key, "question_type", v)}>
                        <SelectTrigger className="h-8 text-xs bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {QUESTION_TYPES.map(qt => (
                            <SelectItem key={qt.value} value={qt.value}>{qt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px] text-gray-400 uppercase">Category</Label>
                      <Input
                        value={q.category || ""}
                        onChange={e => updateQuestion(q._key, "category", e.target.value)}
                        placeholder="e.g. DJ, Planning"
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                    <div className="flex items-end gap-2 pb-0.5">
                      <Switch
                        id={`req_${q._key}`}
                        checked={q.is_required !== false}
                        onCheckedChange={v => updateQuestion(q._key, "is_required", v)}
                        className="scale-90"
                      />
                      <Label htmlFor={`req_${q._key}`} className="text-xs cursor-pointer text-gray-600">Required</Label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {questions.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">
              No questions yet. <button onClick={addQuestion} className="text-violet-600 hover:underline">Add one.</button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Link to={createPageUrl("SurveyTemplates")}>
          <Button variant="outline">Cancel</Button>
        </Link>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-violet-600 hover:bg-violet-700 gap-1.5"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isEdit ? "Save Changes" : "Create Template"}
        </Button>
      </div>
    </div>
  );
}