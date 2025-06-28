import React from 'react';

interface WebRTCSessionProps {
  roomId: string;
  userId: number;
  userName: string;
  readerId: number;
  readerName: string;
  sessionType: 'video' | 'voice' | 'chat';
  isReader: boolean;
  onSessionEnd?: (totalDuration: number) => void;
}

export default function WebRTCSession({
  roomId,
  userId,
  userName,
  readerId,
  readerName,
  sessionType,
  isReader,
  onSessionEnd
}: WebRTCSessionProps) {
  return (
    <div className="flex flex-col w-full max-w-6xl mx-auto p-4">
      <div className="bg-card border rounded-lg p-6">
        <h2 className="text-2xl font-alex-brush text-pink-500 mb-4">
          {sessionType.charAt(0).toUpperCase() + sessionType.slice(1)} Reading Session
        </h2>
        
        <div className="text-center py-8">
          <p className="text-lg mb-4">
            Session with {isReader ? userName : readerName}
          </p>
          <p className="text-muted-foreground">
            Room ID: {roomId}
          </p>
          <p className="text-muted-foreground">
            Session Type: {sessionType}
          </p>
          <p className="text-muted-foreground">
            Role: {isReader ? 'Reader' : 'Client'}
          </p>
        </div>
        
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            WebRTC session component is being updated...
          </p>
        </div>
      </div>
    </div>
  );
} 