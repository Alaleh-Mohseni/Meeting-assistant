import { useState, useEffect } from "preact/hooks";
import { render } from "preact";
import {
  FileText,
  Download,
  Trash2,
  MessageSquare,
  Loader,
  RefreshCw,
} from "lucide-react";
import "./App.css";

const ExtensionApp = () => {
  const [transcripts, setTranscripts] = useState([]);
  const [summary, setSummary] = useState("");
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    console.log("ExtensionApp mounted");
    loadTranscripts();
    checkConnection();
  }, []);

  const loadTranscripts = () => {
    try {
      if (typeof chrome !== "undefined" && chrome.storage) {
        chrome.storage.local.get(["transcripts"], (result) => {
          console.log("Storage result:", result);
          if (chrome.runtime.lastError) {
            console.error("Chrome storage error:", chrome.runtime.lastError);
            setError("خطا در بارگیری داده‌ها");
            return;
          }
          if (result.transcripts) {
            setTranscripts(result.transcripts);
          }
        });
      } else {
        setError("Chrome storage API not available");
      }
    } catch (err) {
      console.error("Error loading transcripts:", err);
      setError(`Error loading transcripts: ${err.message}`);
    }
  };

  const checkConnection = async () => {
    try {
      const response = await fetch("http://localhost:5173/api/health");
      setIsConnected(response.ok);
    } catch (error) {
      console.log("Connection check failed:", error);
      setIsConnected(false);
    }
  };

  const clearTranscripts = () => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.remove(["transcripts"], () => {
        if (chrome.runtime.lastError) {
          console.error(
            "Error clearing transcripts:",
            chrome.runtime.lastError
          );
          setError("خطا در پاک کردن داده‌ها");
          return;
        }
        setTranscripts([]);
      });
    }
  };

  const generateSummary = async () => {
    if (transcripts.length === 0) {
      setSummary("هیچ متنی برای خلاصه‌سازی وجود ندارد.");
      return;
    }

    setIsGeneratingSummary(true);

    try {
      if (isConnected) {
        const response = await fetch(
          "http://localhost:5173/api/generate-summary",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              transcript: transcripts.map((t, index) => ({
                id: index,
                speaker: "شرکت‌کننده",
                text: t.text,
                timestamp: t.timestamp,
                isQuestion: t.isQuestion,
              })),
              speakerNames: ["شرکت‌کننده"],
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          setSummary(data.summary);
        } else {
          throw new Error("خطا در تولید خلاصه");
        }
      } else {
        generateLocalSummary();
      }
    } catch (error) {
      console.error("Error generating summary:", error);
      generateLocalSummary();
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const generateLocalSummary = () => {
    const keyPoints = transcripts
      .filter((t) => t.text.length > 20)
      .map((t) => `• ${t.text}`)
      .slice(0, 10);

    const questions = transcripts
      .filter((t) => t.isQuestion)
      .map((t) => `• ${t.text}`);

    const summaryText = `
خلاصه جلسه Google Meet
تاریخ: ${new Date().toLocaleDateString("fa-IR")}

نکات کلیدی:
${keyPoints.join("\n")}

${questions.length > 0 ? `\nسوالات مطرح شده:\n${questions.join("\n")}` : ""}

تعداد کل پیام‌ها: ${transcripts.length}
    `.trim();

    setSummary(summaryText);
  };

  const exportData = () => {
    const content = `
خلاصه جلسه Google Meet
تاریخ: ${new Date().toLocaleDateString("fa-IR")}

${summary}

متن کامل:
${transcripts
  .map(
    (t, index) =>
      `${index + 1}. ${new Date(t.timestamp).toLocaleTimeString("fa-IR")}: ${
        t.text
      }`
  )
  .join("\n")}
    `;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `google-meet-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const refreshTranscripts = () => {
    loadTranscripts();
    checkConnection();
  };

  if (error) {
    return (
      <div
        className="w-96 h-96 bg-white p-4 overflow-y-auto flex items-center justify-center"
        dir="rtl"
      >
        <div className="text-center">
          <div className="text-red-500 mb-2">⚠️</div>
          <div className="text-sm text-gray-800">{error}</div>
          <button
            onClick={() => {
              setError("");
              loadTranscripts();
            }}
            className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-sm"
          >
            تلاش مجدد
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-96 h-96 bg-white p-4 overflow-y-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-2 border-b">
        <h1 className="text-lg font-bold text-gray-800">دستیار جلسات</h1>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? "bg-green-500" : "bg-red-500"
            }`}
          ></div>
          <button
            onClick={refreshTranscripts}
            className="p-1 text-gray-600 hover:text-gray-800"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-blue-50 p-2 rounded text-center">
          <div className="text-xl font-bold text-blue-600">
            {transcripts.length}
          </div>
          <div className="text-xs text-blue-800">پیام</div>
        </div>
        <div className="bg-green-50 p-2 rounded text-center">
          <div className="text-xl font-bold text-green-600">
            {transcripts.filter((t) => t.isQuestion).length}
          </div>
          <div className="text-xs text-green-800">سوال</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={generateSummary}
          disabled={isGeneratingSummary || transcripts.length === 0}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded text-sm disabled:opacity-50"
        >
          {isGeneratingSummary ? (
            <Loader size={14} className="animate-spin" />
          ) : (
            <FileText size={14} />
          )}
          خلاصه
        </button>

        <button
          onClick={exportData}
          disabled={transcripts.length === 0}
          className="flex items-center gap-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm disabled:opacity-50"
        >
          <Download size={14} />
          دانلود
        </button>

        <button
          onClick={clearTranscripts}
          disabled={transcripts.length === 0}
          className="flex items-center gap-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded text-sm disabled:opacity-50"
        >
          <Trash2 size={14} />
          پاک کردن
        </button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-800 mb-2 flex items-center gap-1">
            <FileText size={14} />
            خلاصه جلسه
          </h3>
          <div className="bg-gray-50 p-3 rounded text-xs max-h-24 overflow-y-auto">
            <pre className="whitespace-pre-wrap">{summary}</pre>
          </div>
        </div>
      )}

      {/* Transcripts */}
      <div className="flex-1">
        <h3 className="text-sm font-medium text-gray-800 mb-2 flex items-center gap-1">
          <MessageSquare size={14} />
          متن جلسه ({transcripts.length})
        </h3>

        <div className="space-y-2 max-h-32 overflow-y-auto">
          {transcripts.length === 0 ? (
            <div className="text-center text-gray-500 text-xs py-4">
              برای شروع، وارد Google Meet شوید و دکمه ضبط را فشار دهید
            </div>
          ) : (
            transcripts.map((transcript, index) => (
              <div key={index} className="bg-gray-50 p-2 rounded text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-600">
                    {new Date(transcript.timestamp).toLocaleTimeString("fa-IR")}
                  </span>
                  {transcript.isQuestion && (
                    <span className="text-xs px-1 py-0 bg-yellow-200 text-yellow-700 rounded">
                      سوال
                    </span>
                  )}
                </div>
                <p className="text-gray-800">{transcript.text}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-4 pt-2 border-t text-xs text-gray-600">
        برای استفاده در Google Meet، روی آیکون ضبط در نوار ابزار کلیک کنید.
      </div>
    </div>
  );
};

const root = document.getElementById("root");
if (root) {
  render(<ExtensionApp />, root);
}
