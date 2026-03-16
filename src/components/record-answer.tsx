/* eslint-disable @typescript-eslint/no-unused-vars */
interface Window {
  webkitSpeechRecognition: new () => SpeechRecognition;
}

interface SpeechRecognition extends EventTarget {
  start(): void;
  stop(): void;
}
import { useAuth } from "@clerk/clerk-react";
import {
  CircleStop,
  Loader,
  Mic,
  RefreshCw,
  Save,
  Video,
  VideoOff,
  WebcamIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import useSpeechToText, { ResultType } from "react-hook-speech-to-text";
import { useParams } from "react-router-dom";
import Webcam from "react-webcam";
import { TooltipButton } from "./tooltip-button";
import { toast } from "sonner";
import { chatSession } from "@/scripts";
import { SaveModal } from "./save-modal";

import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { db } from "@/config/firebase.config";

interface RecordAnswerProps {
  question: { question: string; answer: string };
  isWebCam: boolean;
  setIsWebCam: (value: boolean) => void;
}

interface AIResponse {
  ratings: number;
  feedback: string;
}

export const RecordAnswer = ({
  question,
  isWebCam,
  setIsWebCam,
}: RecordAnswerProps) => {
  const { userId } = useAuth();
  const { interviewId } = useParams();

  const [userAnswer, setUserAnswer] = useState("");
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<AIResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(() => {
        console.log("Microphone permission granted");
      })
      .catch((err) => {
        console.error("Microphone permission denied", err);
        toast.error("Please allow microphone permission");
      });
  }, []);

  /* -------------------------------- SPEECH SETUP -------------------------------- */
  const SpeechRecognition =
    (window as unknown as { SpeechRecognition: any }).SpeechRecognition ||
    window.webkitSpeechRecognition;
  useEffect(() => {
    if (!SpeechRecognition) {
      toast.error("Speech Recognition not supported in this browser");
    }
  }, []);
  const {
    interimResult,
    isRecording,
    results,
    startSpeechToText,
    stopSpeechToText,
  } = useSpeechToText({
    continuous: true,
    useLegacyResults: false,
    speechRecognitionProperties: {
      lang: "en-US",
      interimResults: true,
      maxAlternatives: 1,
    },
  });

  /* -------------------------------- RECORD START / STOP -------------------------------- */

  const recordUserAnswer = async () => {
    try {
      if (!isRecording) {
        setUserAnswer("");
        startSpeechToText();
        toast.success("Recording started");
      } else {
        stopSpeechToText();

        if (userAnswer.length < 30) {
          toast.error("Answer too short");
          return;
        }

        const aiResponse = await generateResult(
          question.question,
          question.answer,
          userAnswer
        );

        setAiResult(aiResponse);
      }
    } catch (error) {
      console.log(error);
      toast.error("Microphone recording failed");
    }
  };

  /* -------------------------------- RESET RECORDING -------------------------------- */

  const recordNewAnswer = () => {
    setUserAnswer("");
    setAiResult(null);

    if (isRecording) {
      stopSpeechToText();
    }

    setTimeout(() => {
      startSpeechToText();
    }, 300);
  };

  /* -------------------------------- CLEAN JSON -------------------------------- */

  const cleanJsonResponse = (responseText: string) => {
    let cleanText = responseText.trim();
    cleanText = cleanText.replace(/(json|```|`)/g, "");

    try {
      return JSON.parse(cleanText);
    } catch {
      throw new Error("Invalid JSON response");
    }
  };

  /* -------------------------------- GENERATE AI FEEDBACK -------------------------------- */

  const generateResult = async (
    qst: string,
    qstAns: string,
    userAns: string
  ): Promise<AIResponse> => {
    setIsAiGenerating(true);

    const prompt = `
Question: "${qst}"

User Answer: "${userAns}"

Correct Answer: "${qstAns}"

Evaluate the user's answer.

Return ONLY JSON:
{
"ratings": number,
"feedback": "improvement suggestion"
}
`;

    try {
      const aiResult = await chatSession.sendMessage(prompt);

      const parsedResult: AIResponse = cleanJsonResponse(
        aiResult.response.text()
      );

      return parsedResult;
    } catch (error) {
      console.log(error);

      toast.error("AI Error", {
        description: "Unable to generate feedback",
      });

      return {
        ratings: 0,
        feedback: "Unable to generate feedback",
      };
    } finally {
      setIsAiGenerating(false);
    }
  };

  /* -------------------------------- SAVE ANSWER -------------------------------- */

  const saveUserAnswer = async () => {
    if (!aiResult) return;

    setLoading(true);

    try {
      const userAnswerQuery = query(
        collection(db, "userAnswers"),
        where("userId", "==", userId),
        where("question", "==", question.question)
      );

      const querySnap = await getDocs(userAnswerQuery);

      if (!querySnap.empty) {
        toast.info("Already Answered", {
          description: "You already answered this question",
        });
        return;
      }

      await addDoc(collection(db, "userAnswers"), {
        mockIdRef: interviewId,
        question: question.question,
        correct_ans: question.answer,
        user_ans: userAnswer,
        feedback: aiResult.feedback,
        rating: aiResult.ratings,
        userId,
        createdAt: serverTimestamp(),
      });

      toast.success("Saved Successfully");

      setUserAnswer("");
      setAiResult(null);

      stopSpeechToText();
    } catch (error) {
      console.log(error);

      toast.error("Error saving answer");
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  /* -------------------------------- TRANSCRIPT UPDATE -------------------------------- */

  useEffect(() => {
    console.log("Speech results:", results);

    const combined = results
      .filter((r): r is ResultType => typeof r !== "string")
      .map((r) => r.transcript)
      .join(" ");

    setUserAnswer(combined);
  }, [results]);
  /* -------------------------------- UI -------------------------------- */

  return (
    <div className="w-full flex flex-col items-center gap-8 mt-4">

      <SaveModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={saveUserAnswer}
        loading={loading}
      />

      {/* Webcam */}

      <div className="w-full h-[400px] md:w-96 flex items-center justify-center border p-4 bg-gray-50 rounded-md">
        {isWebCam ? (
          <Webcam
            onUserMedia={() => setIsWebCam(true)}
            onUserMediaError={() => setIsWebCam(false)}
            className="w-full h-full object-cover rounded-md"
          />
        ) : (
          <WebcamIcon className="min-w-24 min-h-24 text-muted-foreground" />
        )}
      </div>

      {/* Controls */}

      <div className="flex items-center justify-center gap-3">

        <TooltipButton
          content={isWebCam ? "Turn Off Camera" : "Turn On Camera"}
          icon={
            isWebCam ? (
              <VideoOff className="min-w-5 min-h-5" />
            ) : (
              <Video className="min-w-5 min-h-5" />
            )
          }
          onClick={() => setIsWebCam(!isWebCam)}
        />

        <TooltipButton
          content={isRecording ? "Stop Recording" : "Start Recording"}
          icon={
            isRecording ? (
              <CircleStop className="min-w-5 min-h-5 text-red-500" />
            ) : (
              <Mic className="min-w-5 min-h-5 text-green-600" />
            )
          }
          onClick={recordUserAnswer}
        />

        <TooltipButton
          content="Record Again"
          icon={<RefreshCw className="min-w-5 min-h-5" />}
          onClick={recordNewAnswer}
        />

        <TooltipButton
          content="Save Result"
          icon={
            isAiGenerating ? (
              <Loader className="min-w-5 min-h-5 animate-spin" />
            ) : (
              <Save className="min-w-5 min-h-5" />
            )
          }
          onClick={() => setOpen(true)}
          disabled={!aiResult}
        />
      </div>

      {/* User Answer */}

      <div className="w-full mt-4 p-4 border rounded-md bg-gray-50">
        <h2 className="text-lg font-semibold">Your Answer:</h2>

        <p className="text-sm mt-2 text-gray-700 whitespace-normal">
          {userAnswer || "Start recording to see your answer here"}
        </p>

        {interimResult && (
          <p className="text-sm text-gray-500 mt-2">
            <strong>Current Speech:</strong> {interimResult}
          </p>
        )}
      </div>
    </div>
  );
};