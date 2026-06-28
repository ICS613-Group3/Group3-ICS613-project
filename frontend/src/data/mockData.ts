export type ReservationStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'DENIED'
  | 'CANCELLED'
  | 'PICKED_UP'
  | 'RETURNED';

export type ToolCondition = 'New' | 'Like New' | 'Good' | 'Fair' | 'Poor';

export type ToolCategory =
  | 'Power Tools'
  | 'Garden'
  | 'Kitchen'
  | 'Ladders'
  | 'Other';

export interface MockUser {
  id: string;
  displayName: string;
  neighborhood: string;
  rating: number;
  completedLoans: number;
  isAdmin?: boolean;
}

export interface MockTool {
  id: string;
  name: string;
  category: ToolCategory;
  condition: ToolCondition;
  ownerId: string;
  ownerName: string;
  description: string;
  latestReturnTime: string;
  availability: string;
  rating: number;
  imageUrl: string;
  notesForBorrowers: string;
}

export interface MockReservation {
  id: string;
  toolId: string;
  toolName: string;
  borrowerId: string;
  borrowerName: string;
  ownerId: string;
  ownerName: string;
  startDate: string;
  endDate: string;
  status: ReservationStatus;
  role: 'borrower' | 'owner';
  message?: string;
}

export interface MockNotification {
  id: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export const mockUsers: MockUser[] = [
  {
    id: 'user-1',
    displayName: 'Yafei Wang',
    neighborhood: 'Honolulu',
    rating: 4.9,
    completedLoans: 12,
  },
  {
    id: 'user-2',
    displayName: 'Rion Sawabe',
    neighborhood: 'Manoa',
    rating: 4.8,
    completedLoans: 9,
  },
  {
    id: 'user-3',
    displayName: 'Ivan Wu',
    neighborhood: 'Kaimuki',
    rating: 4.7,
    completedLoans: 15,
  },
  {
    id: 'admin-1',
    displayName: 'Admin User',
    neighborhood: 'Honolulu',
    rating: 5.0,
    completedLoans: 20,
    isAdmin: true,
  },
];

export const mockTools: MockTool[] = [
  {
    id: 'tool-1',
    name: 'Cordless Drill',
    category: 'Power Tools',
    condition: 'Good',
    ownerId: 'user-2',
    ownerName: 'Rion Sawabe',
    description:
      '18V cordless drill with charger and extra battery. Good for small home projects.',
    latestReturnTime: '21:00',
    availability: 'Available July 1 - July 10',
    rating: 4.8,
    imageUrl: 'https://placehold.co/600x400?text=Cordless+Drill',
    notesForBorrowers: 'Please return with the battery charged.',
  },
  {
    id: 'tool-2',
    name: 'Garden Shovel',
    category: 'Garden',
    condition: 'Good',
    ownerId: 'user-3',
    ownerName: 'Ivan Wu',
    description:
      'Durable garden shovel for planting, digging, and yard work.',
    latestReturnTime: '18:00',
    availability: 'Available this week',
    rating: 4.6,
    imageUrl: 'https://placehold.co/600x400?text=Garden+Shovel',
    notesForBorrowers: 'Please clean dirt off before returning.',
  },
  {
    id: 'tool-3',
    name: 'Step Ladder',
    category: 'Ladders',
    condition: 'Like New',
    ownerId: 'user-2',
    ownerName: 'Rion Sawabe',
    description:
      'Six-foot step ladder for indoor or outdoor use. Lightweight and easy to carry.',
    latestReturnTime: '20:00',
    availability: 'Available after July 5',
    rating: 4.9,
    imageUrl: 'https://placehold.co/600x400?text=Step+Ladder',
    notesForBorrowers: 'Use on stable ground only.',
  },
  {
    id: 'tool-4',
    name: 'Pressure Washer',
    category: 'Power Tools',
    condition: 'Fair',
    ownerId: 'user-3',
    ownerName: 'Ivan Wu',
    description:
      'Electric pressure washer for driveway, patio, and outdoor cleaning.',
    latestReturnTime: '17:30',
    availability: 'Requested July 2 - July 4',
    rating: 4.4,
    imageUrl: 'https://placehold.co/600x400?text=Pressure+Washer',
    notesForBorrowers: 'Do not use with hot water.',
  },
];

export const mockReservations: MockReservation[] = [
  {
    id: 'reservation-1',
    toolId: 'tool-1',
    toolName: 'Cordless Drill',
    borrowerId: 'user-1',
    borrowerName: 'Yafei Wang',
    ownerId: 'user-2',
    ownerName: 'Rion Sawabe',
    startDate: '2026-07-01',
    endDate: '2026-07-03',
    status: 'REQUESTED',
    role: 'borrower',
    message: 'I need this for a small home repair project.',
  },
  {
    id: 'reservation-2',
    toolId: 'tool-2',
    toolName: 'Garden Shovel',
    borrowerId: 'user-2',
    borrowerName: 'Rion Sawabe',
    ownerId: 'user-1',
    ownerName: 'Yafei Wang',
    startDate: '2026-07-04',
    endDate: '2026-07-05',
    status: 'APPROVED',
    role: 'owner',
    message: 'Borrowing for weekend yard work.',
  },
  {
    id: 'reservation-3',
    toolId: 'tool-3',
    toolName: 'Step Ladder',
    borrowerId: 'user-1',
    borrowerName: 'Yafei Wang',
    ownerId: 'user-2',
    ownerName: 'Rion Sawabe',
    startDate: '2026-06-25',
    endDate: '2026-06-27',
    status: 'PICKED_UP',
    role: 'borrower',
    message: 'Using this to fix a ceiling light.',
  },
  {
    id: 'reservation-4',
    toolId: 'tool-4',
    toolName: 'Pressure Washer',
    borrowerId: 'user-3',
    borrowerName: 'Ivan Wu',
    ownerId: 'user-1',
    ownerName: 'Yafei Wang',
    startDate: '2026-06-15',
    endDate: '2026-06-16',
    status: 'RETURNED',
    role: 'owner',
    message: 'Returned on time.',
  },
];

export const mockNotifications: MockNotification[] = [
  {
    id: 'notification-1',
    message: 'New reservation request for Cordless Drill.',
    read: false,
    createdAt: '2026-06-27 10:15 HST',
  },
  {
    id: 'notification-2',
    message: 'Garden Shovel reservation was approved.',
    read: false,
    createdAt: '2026-06-27 11:20 HST',
  },
  {
    id: 'notification-3',
    message: 'Step Ladder was marked as picked up.',
    read: true,
    createdAt: '2026-06-26 09:00 HST',
  },
];
