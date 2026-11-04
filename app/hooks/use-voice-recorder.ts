import { useRef, useState, useCallback } from "react";

export function useVoiceRecorder() {
	const [isRecording, setIsRecording] = useState(false);
	const [isProcessing, setIsProcessing] = useState(false);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const chunksRef = useRef<Blob[]>([]);

	const startRecording = useCallback(async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const mediaRecorder = new MediaRecorder(stream, {
				mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4",
			});

			chunksRef.current = [];
			mediaRecorderRef.current = mediaRecorder;

			mediaRecorder.ondataavailable = (e) => {
				if (e.data.size > 0) chunksRef.current.push(e.data);
			};

			mediaRecorder.start();
			setIsRecording(true);
		} catch (err) {
			console.error("Microphone access denied", err);
			throw err;
		}
	}, []);

	const stopRecording = useCallback((): Promise<Blob> => {
		return new Promise((resolve, reject) => {
			const mediaRecorder = mediaRecorderRef.current;
			if (!mediaRecorder) {
				reject(new Error("No recording in progress"));
				return;
			}

			mediaRecorder.onstop = () => {
				const blob = new Blob(chunksRef.current, {
					type: mediaRecorder.mimeType,
				});
				// Stop all tracks
				mediaRecorder.stream.getTracks().forEach((t) => t.stop());
				setIsRecording(false);
				resolve(blob);
			};

			mediaRecorder.stop();
		});
	}, []);

	const transcribe = useCallback(async (blob: Blob): Promise<string> => {
		setIsProcessing(true);
		try {
			const formData = new FormData();
			formData.append("audio", blob, "recording.webm");

			const res = await fetch("/api/transcribe", {
				method: "POST",
				body: formData,
			});

			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Transcription failed");

			return data.transcript as string;
		} finally {
			setIsProcessing(false);
		}
	}, []);

	return {
		isRecording,
		isProcessing,
		startRecording,
		stopRecording,
		transcribe,
	};
}
