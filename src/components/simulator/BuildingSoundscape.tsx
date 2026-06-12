"use client";

// Paradigm 5 — Sound as a data channel.
//
// Generative Web Audio soundscape that turns building state into sound:
//   - Low hum that changes pitch with energy load
//   - Water trickle proportional to water flow
//   - Subtle HVAC drone
//   - Ascending tone on incident severity change
//   - Elevator "ding" at each floor arrival
//
// AudioContext is created lazily on first user interaction (browser policy).

import { useEffect, useRef, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import { sceneStore } from "@/lib/scene-store";
import type { Floor } from "@/lib/types";

// ── Audio node factory ────────────────────────────────────────────────

interface SoundNodes {
  ctx: AudioContext;
  master: GainNode;
  humOsc: OscillatorNode;
  humGain: GainNode;
  noiseSource: AudioBufferSourceNode | null;
  noiseGain: GainNode;
  droneOsc: OscillatorNode;
  droneGain: GainNode;
}

let nodes: SoundNodes | null = null;
let audioStarted = false;

function initAudio(): SoundNodes | null {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.value = 0.15;
    master.connect(ctx.destination);

    // Low hum (energy load)
    const humOsc = ctx.createOscillator();
    humOsc.type = "sawtooth";
    humOsc.frequency.value = 55;
    const humGain = ctx.createGain();
    humGain.gain.value = 0;
    humOsc.connect(humGain);
    humGain.connect(master);

    // HVAC drone (filtered noise)
    const bufferSize = ctx.sampleRate * 1;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0;
    noiseSource.connect(noiseGain);
    noiseGain.connect(master);

    // Subtle drone (always-on C pedal)
    const droneOsc = ctx.createOscillator();
    droneOsc.type = "sine";
    droneOsc.frequency.value = 65.41; // C2
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.04;
    droneOsc.connect(droneGain);
    droneGain.connect(master);

    humOsc.start();
    droneOsc.start();
    if (!noiseSource.start) {
      // some older browsers
    } else {
      noiseSource.start();
    }

    nodes = { ctx, master, humOsc, humGain, noiseSource, noiseGain, droneOsc, droneGain };
    return nodes;
  } catch {
    return null;
  }
}

// ── Alert synth (one-shot ascending tone) ──────────────────────────────

function playAlertTone(ctx: AudioContext, severity: string) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  const baseFreq = severity === "crit" ? 880 : severity === "warn" ? 660 : 440;
  osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, ctx.currentTime + 0.15);
  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.5);
}

// ── Elevator ding ──────────────────────────────────────────────────────

function playDing(ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 1200;
  gain.gain.setValueAtTime(0.06, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.3);
}

// ── Component ──────────────────────────────────────────────────────────

export default function BuildingSoundscape({
  floors,
  elevatorFloor,
}: {
  floors: Floor[];
  elevatorFloor: number;
}) {
  const prevSeverityRef = useRef<string>("ok");
  const prevElevatorFloorRef = useRef(elevatorFloor);

  // Initialise audio lazily (requires user gesture)
  const ensureAudio = useCallback(() => {
    if (!audioStarted) {
      const n = initAudio();
      if (n) audioStarted = true;
    }
  }, []);

  useEffect(() => {
    // Listen for first pointer event anywhere
    const handler = () => {
      ensureAudio();
      document.removeEventListener("pointerdown", handler);
    };
    document.addEventListener("pointerdown", handler);

    // Also try on mount — might work if already interacted
    ensureAudio();

    return () => document.removeEventListener("pointerdown", handler);
  }, [ensureAudio]);

  // Detect severity changes → alert tone
  useEffect(() => {
    if (!nodes) return;

    // Check incident severity across all floors
    let worst = "ok";
    for (const f of floors) {
      // In a real app we'd read from the incident list. For now, derive from metrics.
      if (f.metrics.co2Ppm != null && f.metrics.co2Ppm > 1200) worst = "crit";
      else if (f.metrics.co2Ppm != null && f.metrics.co2Ppm > 800) worst = "warn";
    }
    if (worst !== prevSeverityRef.current && worst !== "ok") {
      playAlertTone(nodes.ctx, worst);
    }
    prevSeverityRef.current = worst;
  }, [floors]);

  // Elevator ding detection
  useEffect(() => {
    if (!nodes) return;
    if (elevatorFloor !== prevElevatorFloorRef.current) {
      playDing(nodes.ctx);
      prevElevatorFloorRef.current = elevatorFloor;
    }
  }, [elevatorFloor]);

  // Continuous modulation via useFrame
  useFrame(() => {
    if (!nodes) return;

    // Aggregate metrics from all floors
    let totalLoad = 0;
    let totalWater = 0;
    for (const f of floors) {
      if (f.metrics.loadKw) totalLoad += f.metrics.loadKw;
      if (f.metrics.waterLph) totalWater += f.metrics.waterLph;
    }

    // Hum pitch follows energy load (40–120 Hz)
    const humFreq = 40 + Math.min(totalLoad / 50, 1) * 80;
    nodes.humOsc.frequency.setTargetAtTime(humFreq, nodes.ctx.currentTime, 0.1);

    // Hum volume follows load (0 – 0.08)
    const humVol = Math.min(totalLoad / 100, 1) * 0.08;
    nodes.humGain.gain.setTargetAtTime(humVol, nodes.ctx.currentTime, 0.1);

    // Noise volume follows water flow
    const noiseVol = Math.min(totalWater / 2000, 1) * 0.04;
    nodes.noiseGain.gain.setTargetAtTime(noiseVol, nodes.ctx.currentTime, 0.1);
  });

  return null;
}
