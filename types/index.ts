export type TicketStatus =
  | 'BACKLOG'
  | 'UP_NEXT'
  | 'IN_REVIEW'
  | 'IN_PROGRESS'
  | 'IN_TESTING'
  | 'COMPLETED';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';

export type RalphStatus = 'LAUNCHING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export type DevServerStatus = 'STOPPED' | 'STARTING' | 'RUNNING' | 'ERROR';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  codePath: string;
  gitUrl: string | null;
  productionUrl: string | null;
  color: string;
  importedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  tickets?: Ticket[];
  devServerPort: number | null;
  devServerStatus: DevServerStatus;
  devServerPid: string | null;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: Priority;
  prdContent: string | null;
  prdGeneratedAt: Date | null;
  ralphInstancePath: string | null;
  ralphStatus: RalphStatus | null;
  ralphStartedAt: Date | null;
  ralphCompletedAt: Date | null;
  ralphLogs: string | null;
  project?: Project;
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Column {
  id: TicketStatus;
  title: string;
  color: string;
}
