import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

interface WebRTCSession {
  id: string;
  readerId: string;
  clientId: string;
  startTime: Date;
  isActive: boolean;
  billingInterval?: NodeJS.Timeout;
}

class WebRTCService {
  private io: SocketIOServer | null = null;
  private sessions: Map<string, WebRTCSession> = new Map();
  private turnServers = [
    {
      urls: 'stun:stun.l.google.com:19302'
    }
  ];

  initialize(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    this.io.on('connection', (socket) => {
      console.log('WebRTC client connected:', socket.id);

      socket.on('join-session', async (data: { sessionId: string; userId: string; role: 'reader' | 'client' }) => {
        try {
          const { sessionId, userId, role } = data;
          
          socket.join(sessionId);
          
          if (role === 'reader') {
            socket.to(sessionId).emit('reader-joined', { readerId: userId });
          } else {
            socket.to(sessionId).emit('client-joined', { clientId: userId });
          }
          
          console.log(`User ${userId} joined session ${sessionId} as ${role}`);
        } catch (error) {
          console.error('Error joining session:', error);
          socket.emit('error', { message: 'Failed to join session' });
        }
      });

      socket.on('offer', (data: { sessionId: string; offer: RTCSessionDescriptionInit }) => {
        socket.to(data.sessionId).emit('offer', data.offer);
      });

      socket.on('answer', (data: { sessionId: string; answer: RTCSessionDescriptionInit }) => {
        socket.to(data.sessionId).emit('answer', data.answer);
      });

      socket.on('ice-candidate', (data: { sessionId: string; candidate: RTCIceCandidateInit }) => {
        socket.to(data.sessionId).emit('ice-candidate', data.candidate);
      });

      socket.on('start-session', async (data: { sessionId: string; readerId: string; clientId: string }) => {
        try {
          const { sessionId, readerId, clientId } = data;
          
          const session: WebRTCSession = {
            id: sessionId,
            readerId,
            clientId,
            startTime: new Date(),
            isActive: true
          };
          
          this.sessions.set(sessionId, session);
          
          // Start billing interval (every minute)
          session.billingInterval = setInterval(() => {
            this.processBilling(sessionId);
          }, 60000);
          
          console.log(`Session ${sessionId} started`);
          socket.emit('session-started', { sessionId });
        } catch (error) {
          console.error('Error starting session:', error);
          socket.emit('error', { message: 'Failed to start session' });
        }
      });

      socket.on('end-session', async (data: { sessionId: string }) => {
        try {
          const { sessionId } = data;
          const session = this.sessions.get(sessionId);
          
          if (session) {
            session.isActive = false;
            if (session.billingInterval) {
              clearInterval(session.billingInterval);
            }
            this.sessions.delete(sessionId);
            
            socket.to(sessionId).emit('session-ended');
            console.log(`Session ${sessionId} ended`);
          }
        } catch (error) {
          console.error('Error ending session:', error);
        }
      });

      socket.on('disconnect', () => {
        console.log('WebRTC client disconnected:', socket.id);
      });
    });

    console.log('WebRTC service initialized');
  }

  private async processBilling(sessionId: string) {
    try {
      const session = this.sessions.get(sessionId);
      if (!session || !session.isActive) return;

      // Calculate duration and amount
      const duration = Math.floor((Date.now() - session.startTime.getTime()) / 1000);
      const amountPerMinute = 2.00; // $2.00 per minute
      const amount = (duration / 60) * amountPerMinute;

      // Here you would integrate with your billing system
      console.log(`Billing session ${sessionId}: ${duration}s = $${amount.toFixed(2)}`);
      
      // Emit billing update to client
      this.io?.to(sessionId).emit('billing-update', {
        duration,
        amount: amount.toFixed(2)
      });
    } catch (error) {
      console.error('Error processing billing:', error);
    }
  }

  getTurnServers() {
    return this.turnServers;
  }

  getActiveSessions() {
    return Array.from(this.sessions.values());
  }
}

export const webRTCService = new WebRTCService(); 