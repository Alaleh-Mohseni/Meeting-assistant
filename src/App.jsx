import { useState, useRef, useEffect } from "react";
import {
  Mic,
  MicOff,
  Download,
  FileText,
  MessageSquare,
  UserPlus,
  Edit2,
  Trash2,
  Check,
  X,
  SquareX,
  Loader,
} from "lucide-react";
import "./App.css";

const App = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [summary, setSummary] = useState("");
  const [speakerNames, setSpeakerNames] = useState(["شخص ۱", "شخص ۲"]);
  const [currentSpeaker, setCurrentSpeaker] = useState(0);
  const [newSpeakerName, setNewSpeakerName] = useState("");
  const [editingSpeaker, setEditingSpeaker] = useState(null);
  const [showAddSpeaker, setShowAddSpeaker] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");

  const mediaRecorderRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);

  // Check backend connection
  useEffect(() => {
    checkBackendConnection();
  }, []);

  const checkBackendConnection = async () => {
    try {
      const response = await fetch(`/health`);
      if (response.ok) {
        setConnectionStatus("connected");
      } else {
        setConnectionStatus("error");
      }
    } catch (error) {
      console.error("Backend connection failed:", error);
      setConnectionStatus("error");
    }
  };

  // Initialize Speech Recognition with fallback
  useEffect(() => {
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "fa-IR";

      recognitionRef.current.onresult = (event) => {
        let finalTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }

        if (finalTranscript) {
          const newEntry = {
            id: Date.now(),
            speaker: speakerNames[currentSpeaker],
            text: finalTranscript,
            timestamp: new Date().toLocaleTimeString("fa-IR"),
            isQuestion:
              finalTranscript.includes("؟") ||
              /\bچی\b|\bچه\b|\bکی\b|\bکجا\b|\bچرا\b|\bچطور\b|\bآیا\b/.test(
                finalTranscript
              ),
          };
          setTranscript((prev) => [...prev, newEntry]);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
      };
    }
  }, [currentSpeaker, speakerNames]);

  const sendAudioToBackend = async (audioBlob) => {
    if (connectionStatus !== "connected") return;

    try {
      setIsProcessingAudio(true);
      const formData = new FormData();
      formData.append("audio", audioBlob);
      formData.append("speakerCount", speakerNames.length.toString());

      const response = await fetch(`transcribe`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();

        const newEntries = data.transcription.map((item, index) => {
          const speakerIndex = (item.speakerTag - 1) % speakerNames.length;
          return {
            id: Date.now() + index,
            speaker: speakerNames[speakerIndex],
            text: item.transcript,
            timestamp: `${item.startTime} - ${item.endTime}`,
            confidence: data.confidence ?? null,
            isQuestion:
              item.transcript.includes("؟") ||
              /\bچی\b|\bچه\b|\bکی\b|\bکجا\b|\bچرا\b|\bچطور\b|\bآیا\b/.test(
                item.transcript
              ),
          };
        });

        setTranscript((prev) => [...prev, ...newEntries]);
      }
    } catch (error) {
      console.error("Error sending audio to backend:", error);
    } finally {
      setIsProcessingAudio(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });

        // Send to backend for advanced processing if connected
        if (connectionStatus === "connected") {
          sendAudioToBackend(audioBlob);
        }
      };

      // Record in chunks for continuous processing
      mediaRecorderRef.current.start();
      recordingIntervalRef.current = setInterval(() => {
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state === "recording"
        ) {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current.start();
        }
      }, 30000); // Process every 30 seconds

      if (recognitionRef.current) {
        recognitionRef.current.start();
      }

      setIsRecording(true);
    } catch (error) {
      console.error("Error starting recording:", error);
      alert("خطا در شروع ضبط صدا. لطفاً مجوز میکروفون را بررسی کنید.");
    }
  };

  const stopRecording = () => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    setIsRecording(false);
  };

  const deleteTranscriptEntry = (id) => {
    setTranscript((prev) => prev.filter((entry) => entry.id !== id));
  };

  const generateSummary = async () => {
    if (transcript.length === 0) {
      setSummary("هیچ متنی برای خلاصه‌سازی وجود ندارد.");
      return;
    }

    setIsGeneratingSummary(true);

    try {
      if (connectionStatus === "connected") {
        // Use AI-powered summary
        const response = await fetch(`generate-summary`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            transcript: transcript,
            speakerNames: speakerNames,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setSummary(data.summary);
        } else {
          throw new Error("Summary generation failed");
        }
      } else {
        // Fallback to local summary
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
    const keyPoints = transcript
      .filter((entry) => entry.text.length > 20)
      .map((entry) => `• ${entry.speaker}: ${entry.text}`)
      .slice(0, 10);

    const questions = transcript
      .filter((entry) => entry.isQuestion)
      .map((entry) => `• ${entry.text}`);

    const summaryText = `
خلاصه جلسه - ${new Date().toLocaleDateString("fa-IR")}

شرکت‌کنندگان:
${speakerNames.map((name) => `• ${name}`).join("\n")}

نکات کلیدی:
${keyPoints.join("\n")}

${questions.length > 0 ? `\nسوالات مطرح شده:\n${questions.join("\n")}` : ""}

تعداد کل پیام‌ها: ${transcript.length}
مدت زمان تقریبی: ${Math.ceil(transcript.length / 3)} دقیقه
    `.trim();

    setSummary(summaryText);
  };

  const resetSummary = () => {
    setSummary("");
  };

  const exportToPDF = () => {
    const content = `
خلاصه جلسه
تاریخ: ${new Date().toLocaleDateString("fa-IR")}

${summary}

متن کامل جلسه:
${transcript
  .map((entry) => `${entry.timestamp} - ${entry.speaker}: ${entry.text}`)
  .join("\n")}
    `;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meeting-summary-${
      new Date().toISOString().split("T")[0]
    }.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const addSpeaker = () => {
    if (newSpeakerName.trim()) {
      setSpeakerNames([...speakerNames, newSpeakerName.trim()]);
      setNewSpeakerName("");
      setShowAddSpeaker(false);
    }
  };

  const editSpeaker = (index, newName) => {
    if (newName.trim()) {
      const updatedNames = [...speakerNames];
      const oldName = updatedNames[index];
      updatedNames[index] = newName.trim();
      setSpeakerNames(updatedNames);

      setTranscript((prev) =>
        prev.map((entry) =>
          entry.speaker === oldName
            ? { ...entry, speaker: newName.trim() }
            : entry
        )
      );
    }
    setEditingSpeaker(null);
  };

  const deleteSpeaker = (index) => {
    if (speakerNames.length > 1) {
      const removedName = speakerNames[index];
      const updatedNames = speakerNames.filter((_, i) => i !== index);
      setSpeakerNames(updatedNames);

      if (currentSpeaker === index) {
        setCurrentSpeaker(0);
      } else if (currentSpeaker > index) {
        setCurrentSpeaker(currentSpeaker - 1);
      }

      setTranscript((prev) =>
        prev.filter((entry) => entry.speaker !== removedName)
      );
    }
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4"
      dir="rtl"
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-4 text-center">
            ضبط کننده جلسات
          </h1>

          {/* Connection Status */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <div
              className={`w-3 h-3 rounded-full ${
                connectionStatus === "connected"
                  ? "bg-green-500"
                  : connectionStatus === "error"
                  ? "bg-red-500"
                  : "bg-yellow-500"
              }`}
            ></div>
            <span className="text-sm text-gray-600">
              {connectionStatus === "connected"
                ? "متصل به سرور"
                : connectionStatus === "error"
                ? "عدم اتصال به سرور (حالت محلی)"
                : "در حال اتصال..."}
            </span>
          </div>

          {/* Recording Controls */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-6">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessingAudio}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-lg transition-all touch-manipulation ${
                isRecording
                  ? "bg-red-500 hover:bg-red-600 text-white shadow-lg"
                  : "bg-green-500 hover:bg-green-600 text-white shadow-lg"
              } ${isProcessingAudio ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {isProcessingAudio ? (
                <Loader size={24} className="animate-spin" />
              ) : isRecording ? (
                <MicOff size={24} />
              ) : (
                <Mic size={24} />
              )}
              {isProcessingAudio
                ? "در حال پردازش..."
                : isRecording
                ? "توقف ضبط"
                : "شروع ضبط"}
            </button>

            <button
              onClick={generateSummary}
              disabled={isGeneratingSummary}
              className="flex items-center gap-2 px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-medium transition-all touch-manipulation disabled:opacity-50"
            >
              {isGeneratingSummary ? (
                <Loader size={20} className="animate-spin" />
              ) : (
                <FileText size={20} />
              )}
              {isGeneratingSummary ? "در حال تولید..." : "ایجاد خلاصه"}
            </button>

            <button
              onClick={exportToPDF}
              className="flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-all touch-manipulation"
            >
              <Download size={20} />
              دانلود
            </button>
          </div>

          {/* Speaker Management */}
          <div className="mb-6">
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="text-gray-600 font-medium">
                مدیریت شرکت‌کنندگان:
              </span>
            </div>

            <div className="flex flex-wrap justify-center gap-2 mb-4">
              {speakerNames.map((speaker, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-1 px-3 py-2 rounded-lg transition-all ${
                    currentSpeaker === index
                      ? "bg-indigo-500 text-white"
                      : "bg-gray-200 text-gray-700"
                  }`}
                >
                  {editingSpeaker === index ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        defaultValue={speaker}
                        className="w-20 px-1 py-0 text-sm bg-white text-gray-800 rounded border-none outline-none"
                        onKeyPress={(e) => {
                          if (e.key === "Enter") {
                            editSpeaker(index, e.target.value);
                          }
                        }}
                        onBlur={(e) => editSpeaker(index, e.target.value)}
                        autoFocus
                      />
                      <button
                        onClick={() =>
                          editSpeaker(
                            index,
                            document.querySelector("input").value
                          )
                        }
                        className="text-green-600 hover:text-green-800"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => setEditingSpeaker(null)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setCurrentSpeaker(index)}
                        className="font-medium"
                      >
                        {speaker}
                      </button>
                      <button
                        onClick={() => setEditingSpeaker(index)}
                        className="text-blue-600 hover:text-blue-800 opacity-70 hover:opacity-100"
                      >
                        <Edit2 size={14} />
                      </button>
                      {speakerNames.length > 1 && (
                        <button
                          onClick={() => deleteSpeaker(index)}
                          className="text-red-600 hover:text-red-800 opacity-70 hover:opacity-100"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              ))}

              {/* Add Speaker */}
              {showAddSpeaker ? (
                <div className="flex items-center gap-1 px-3 py-2 bg-green-100 rounded-lg">
                  <input
                    type="text"
                    value={newSpeakerName}
                    onChange={(e) => setNewSpeakerName(e.target.value)}
                    placeholder="نام شرکت‌کننده"
                    className="w-24 px-1 py-0 text-sm bg-white rounded border-none outline-none"
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        addSpeaker();
                      }
                    }}
                    autoFocus
                  />
                  <button
                    onClick={addSpeaker}
                    className="text-green-600 hover:text-green-800"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => {
                      setShowAddSpeaker(false);
                      setNewSpeakerName("");
                    }}
                    className="text-red-600 hover:text-red-800"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddSpeaker(true)}
                  className="flex items-center gap-1 px-3 py-2 bg-green-200 hover:bg-green-300 text-green-700 rounded-lg font-medium transition-all touch-manipulation"
                >
                  <UserPlus size={16} />
                  افزودن شرکت‌کننده
                </button>
              )}
            </div>

            {/* Current Speaker Indicator */}
            <div className="text-center">
              <span className="text-gray-600 text-sm">
                گوینده فعال:
                <span className="font-bold text-indigo-600 mr-1">
                  {speakerNames[currentSpeaker]}
                </span>
              </span>
            </div>
          </div>

          {/* Status Indicator */}
          {(isRecording || isProcessingAudio) && (
            <div className="flex items-center justify-center gap-2 text-red-600">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span>
                {isRecording && !isProcessingAudio
                  ? "در حال ضبط..."
                  : isProcessingAudio
                  ? "در حال پردازش صوت..."
                  : "در حال ضبط..."}
              </span>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Transcript Panel */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="text-blue-500" size={24} />
              <h2 className="text-xl font-bold text-gray-800">متن جلسه</h2>
              <span className="text-sm text-gray-500 mr-auto">
                ({transcript.length} پیام)
              </span>
            </div>

            <div className="h-96 overflow-y-auto bg-gray-50 rounded-xl p-4 space-y-3">
              {transcript.length === 0 ? (
                <div className="text-center text-gray-500 mt-20">
                  برای شروع، دکمه "شروع ضبط" را فشار دهید
                </div>
              ) : (
                transcript.map((entry) => (
                  <div
                    key={entry.id}
                    className="bg-white rounded-lg p-4 shadow-sm border-r-4 border-gray-200"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-indigo-600">
                          {entry.speaker}
                        </span>
                        {entry.confidence && (
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                            {Math.round(entry.confidence * 100)}%
                          </span>
                        )}
                        {entry.isQuestion && (
                          <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full">
                            سوال
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">
                          {entry.timestamp}
                        </span>
                        <button
                          onClick={() => deleteTranscriptEntry(entry.id)}
                          className="text-red-600 hover:text-red-800 opacity-70 hover:opacity-100"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <p
                      className={`text-gray-800 leading-relaxed ${
                        entry.isQuestion
                          ? "bg-yellow-50 p-3 rounded border-r-4 border-yellow-400"
                          : ""
                      }`}
                    >
                      {entry.text}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Side Panel */}
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="text-green-500" size={24} />
                  <h3 className="text-lg font-bold text-gray-800">
                    خلاصه جلسه
                  </h3>
                </div>
                {summary && (
                  <button
                    onClick={resetSummary}
                    className="flex items-center gap-1 text-red-600 hover:text-red-800"
                  >
                    <SquareX size={16} />
                  </button>
                )}
              </div>

              <div className="bg-gray-50 rounded-lg p-4 h-80 overflow-y-auto">
                {summary ? (
                  <pre className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">
                    {summary}
                  </pre>
                ) : (
                  <div className="text-center text-gray-500 mt-28">
                    برای دریافت خلاصه، دکمه "ایجاد خلاصه" را فشار دهید
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
