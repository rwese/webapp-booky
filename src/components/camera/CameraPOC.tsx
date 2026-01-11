/**
 * Minimal Proof of Concept for Camera Functionality
 * 
 * This POC tests the core camera functionality to validate our implementation approach.
 * It has minimal complexity: basic camera access, video display, and simple lifecycle handling.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';

const CameraPOC: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<string>('Initializing...');
  const [error, setError] = useState<string | null>(null);
  const [videoState, setVideoState] = useState<string>('not ready');
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const startCamera = async () => {
    try {
      setStatus('Requesting camera access...');
      console.log('Starting camera access...');

      // Test 1: Basic getUserMedia with simple constraints
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      console.log('Calling getUserMedia with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Camera access granted, stream:', stream);
      
      streamRef.current = stream;
      setStatus('Camera access granted, attaching to video element...');

      // Test 2: Simple video element attachment
      if (videoRef.current) {
        console.log('Attaching stream to video element...');
        videoRef.current.srcObject = stream;
        
        // Reset state flags
        setIsReady(false);
        setIsPlaying(false);

        // Test 3: Proper play sequence with comprehensive readiness handling
        console.log('Waiting for video to be ready...');
        
        await new Promise<void>((resolve, reject) => {
          let resolved = false;
          let rejected = false;
          
          const resolveOnce = () => {
            if (!resolved && !rejected) {
              resolved = true;
              resolve();
            }
          };
          
          const rejectOnce = (err: Error) => {
            if (!resolved && !rejected) {
              rejected = true;
              reject(err);
            }
          };

          const onLoadedMetadata = () => {
            console.log('loadedmetadata event received');
            console.log({
              readyState: videoRef.current?.readyState,
              networkState: videoRef.current?.networkState,
              videoWidth: videoRef.current?.videoWidth,
              videoHeight: videoRef.current?.videoHeight,
            });
            
            // Check if video has proper dimensions
            if (videoRef.current?.videoWidth && videoRef.current?.videoHeight) {
              resolveOnce();
            }
          };

          const onCanPlay = () => {
            console.log('canplay event received');
            console.log({
              readyState: videoRef.current?.readyState,
              networkState: videoRef.current?.networkState,
              paused: videoRef.current?.paused,
              srcObject: !!videoRef.current?.srcObject,
              videoWidth: videoRef.current?.videoWidth,
              videoHeight: videoRef.current?.videoHeight,
            });
            
            setIsReady(true);
          };

          const onError = (e: Event) => {
            console.error('Video error event:', e);
            rejectOnce(new Error('Video element error'));
          };

          videoRef.current?.addEventListener('loadedmetadata', onLoadedMetadata);
          videoRef.current?.addEventListener('canplay', onCanPlay);
          videoRef.current?.addEventListener('error', onError);

          // Timeout after 10 seconds
          const timeoutId = setTimeout(() => {
            if (!resolved && !rejected) {
              console.error('Video readiness timeout - checking current state:');
              console.log({
                readyState: videoRef.current?.readyState,
                networkState: videoRef.current?.networkState,
                paused: videoRef.current?.paused,
                srcObject: !!videoRef.current?.srcObject,
                videoWidth: videoRef.current?.videoWidth,
                videoHeight: videoRef.current?.videoHeight,
              });
              rejectOnce(new Error('Video loadedmetadata timeout'));
            }
          }, 10000);

          // Cleanup function for this promise
          const cleanup = () => {
            clearTimeout(timeoutId);
            videoRef.current?.removeEventListener('loadedmetadata', onLoadedMetadata);
            videoRef.current?.removeEventListener('canplay', onCanPlay);
            videoRef.current?.removeEventListener('error', onError);
          };

          // Store cleanup for later use
          (videoRef.current as any).__cleanup = cleanup;
        });

        console.log('Video metadata loaded, calling video.play()...');
        
        // Handle play() promise with proper error handling for autoplay policies
        try {
          await videoRef.current.play();
          console.log('Video play successful!');
          console.log({
            readyState: videoRef.current.readyState,
            networkState: videoRef.current.networkState,
            paused: videoRef.current.paused,
            srcObject: !!videoRef.current.srcObject,
            videoWidth: videoRef.current.videoWidth,
            videoHeight: videoRef.current.videoHeight,
          });
          setIsPlaying(true);
          setStatus('Camera active and streaming');
          setVideoState('playing');
        } catch (playErr) {
          console.error('Video play() failed:', playErr);
          
          // Check for autoplay policy restrictions
          if (videoRef.current?.paused) {
            console.warn('Autoplay policy may be blocking video play - video is still paused');
            setStatus('Camera access granted but autoplay blocked - tap to play');
            setVideoState('autoplay_blocked');
          } else {
            throw playErr;
          }
        }
      }

    } catch (err) {
      console.error('Camera access failed:', err);
      setError(`Camera access failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setStatus('Camera access failed');
      setIsReady(false);
      setIsPlaying(false);
    }
  };

  const stopCamera = useCallback(() => {
    console.log('Stopping camera...');
    
    if (streamRef.current) {
      console.log('Stopping all tracks in stream...');
      streamRef.current.getTracks().forEach(track => {
        console.log(`Stopping track: ${track.kind}`);
        track.stop();
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      console.log('Clearing video element...');
      // Cleanup any event listeners from startCamera
      const cleanup = (videoRef.current as any).__cleanup;
      if (cleanup) {
        cleanup();
        delete (videoRef.current as any).__cleanup;
      }
      videoRef.current.srcObject = null;
    }

    setStatus('Camera stopped');
    setVideoState('stopped');
    setIsReady(false);
    setIsPlaying(false);
  }, []);

  // Test 4: Video element state monitoring
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handleStateChange = () => {
      console.log(`Video state changed: readyState=${videoElement.readyState}, paused=${videoElement.paused}`);
      setVideoState(`readyState: ${videoElement.readyState}, paused: ${videoElement.paused}`);
      
      // Update playing state based on actual video element state
      setIsPlaying(!videoElement.paused && !videoElement.ended);
    };

    videoElement.addEventListener('play', handleStateChange);
    videoElement.addEventListener('pause', handleStateChange);
    videoElement.addEventListener('ended', handleStateChange);
    videoElement.addEventListener('error', handleStateChange);
    
    // Also listen for canplay to update ready state
    videoElement.addEventListener('canplay', () => setIsReady(true));
    videoElement.addEventListener('waiting', () => setIsReady(false));

    return () => {
      videoElement.removeEventListener('play', handleStateChange);
      videoElement.removeEventListener('pause', handleStateChange);
      videoElement.removeEventListener('ended', handleStateChange);
      videoElement.removeEventListener('error', handleStateChange);
      videoElement.removeEventListener('canplay', () => setIsReady(true));
      videoElement.removeEventListener('waiting', () => setIsReady(false));
    };
  }, []);

  // Cleanup on unmount - stop camera when component unmounts
  useEffect(() => {
    return () => {
      console.log('CameraPOC component unmounting, stopping camera...');
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
        });
        streamRef.current = null;
      }
      if (videoRef.current) {
        // Cleanup any event listeners from startCamera
        const cleanup = (videoRef.current as any).__cleanup;
        if (cleanup) {
          cleanup();
          delete (videoRef.current as any).__cleanup;
        }
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
      <h2>Camera POC - Minimal Implementation</h2>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Status:</strong> <span style={{ color: error ? 'red' : 'green' }}>{status}</span>
      </div>
      
      {error && (
        <div style={{ marginBottom: '10px', color: 'red' }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Video State:</strong> {videoState}
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Ready State:</strong> {isReady ? 'Ready' : 'Not Ready'} | 
        <strong> Playing:</strong> {isPlaying ? 'Yes' : 'No'}
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <button 
          onClick={startCamera}
          style={{ marginRight: '10px', padding: '10px 20px', cursor: 'pointer' }}
          type="button"
        >
          Start Camera
        </button>
        <button 
          onClick={stopCamera}
          style={{ padding: '10px 20px', cursor: 'pointer' }}
          type="button"
        >
          Stop Camera
        </button>
      </div>
      
      <div style={{ border: '2px solid #333', width: '640px', height: '480px', backgroundColor: '#000' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
      
      <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
        <h3>POC Test Goals:</h3>
        <ol>
          <li>Validate basic getUserMedia functionality</li>
          <li>Test video element attachment and play sequence</li>
          <li>Monitor video element lifecycle events</li>
          <li>Identify any browser-specific issues</li>
          <li>Establish baseline for comparison with full implementation</li>
        </ol>
      </div>
    </div>
  );
};

export default CameraPOC;