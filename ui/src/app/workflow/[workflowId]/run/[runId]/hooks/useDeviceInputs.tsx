import { useCallback, useEffect, useState } from "react";
import logger from "@/lib/logger";

export const useDeviceInputs = () => {
    const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
    const [selectedAudioInput, setSelectedAudioInput] = useState('');
    const [permissionError, setPermissionError] = useState<string | null>(null);

    const getAudioInputDevices = useCallback(async () => {
        try {
            if (!navigator?.mediaDevices?.enumerateDevices) {
                logger.warn('navigator.mediaDevices is undefined (insecure HTTP context or unsupported browser)');
                setPermissionError('Microphone access requires HTTPS or localhost');
                return;
            }
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioDevices = devices.filter(device => device.kind === 'audioinput');
            setAudioInputs(audioDevices);

            const defaultAudioInput = audioDevices.find(device => device.deviceId === 'default');
            if (defaultAudioInput) {
                setSelectedAudioInput(defaultAudioInput.deviceId);
            }
        } catch {
            setPermissionError('Could not enumerate devices');
        }
    }, []);

    useEffect(() => {
        getAudioInputDevices();
    }, [getAudioInputDevices]);

    return {
        audioInputs,
        selectedAudioInput,
        setSelectedAudioInput,
        permissionError,
        setPermissionError,
        getAudioInputDevices
    };
};
