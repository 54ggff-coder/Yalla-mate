/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// User-related Types
export interface Profile {
  // Core Profile Info
  id: string;
  email?: string;
  name: string; // Legacy fallback
  username?: string;
  displayName?: string;
  bio?: string;
  phone: string;
  location: string; // E.g., Riyadh, Dubai, Cairo
  city?: string;
  avatar: string; // Emoji or preset avatar url
  coverPhoto?: string;
  archetype: string; // The Quiet Coffee Reader, etc.
  trustScore: number; // 0.0 to 10.0 (converted to a 10-point scale now)
  reputationScore?: number;
  verified: boolean;
  interests: string[];
  joinedAt?: string;
  lastActive?: string;
  followersCount?: number;
  followingCount?: number;
  friendsCount?: number;
  preferences?: {
    restaurants?: string[];
    sports?: string[];
    general?: string[];
    exactLat?: number;
    exactLng?: number;
    district?: string;
    country?: string;
  };
  badges: string[]; // "Always On Time", "Super Driver", "Great Voice", "Fair Payer", "City Explorer", "Trip Leader", "Outing Photographer"
  warningCount: number;
  suspended: boolean;
  gender: 'male' | 'female';
  preferred_lang?: 'ar' | 'en';
  hobbies?: string[];
  favoriteFood?: string;
  favoritePlayground?: string;
  musicPreference?: 'rashed' | 'talal' | string;
  sportsTeam?: 'madrid' | 'barca' | string;
  xp?: number; // Experience points
  level?: number; // Experience level
  emergencyContactName?: string; // Trusted emergency contact
  emergencyContactPhone?: string; // Trusted emergency phone number
  
  // Social Networking Features
  followers: string[];
  following: string[];
  privacyStatus: 'public' | 'private';
  dmStatus: 'everyone' | 'followers';
  hideFollowers: boolean;
  notificationEnabled?: boolean;
  notificationPreferences?: {
    friendRequests: boolean;
    outingAlerts: boolean;
    messages: boolean;
  };
  onboarding_completed?: boolean;
  trips?: number;
  outings?: number;
  warnings?: number;
  moodEmoji?: string;
  moodText?: string;
  reportCount?: number;
}

// Activity Category definitions
export type ActivityCategory =
  | 'Restaurants'
  | 'Cafes'
  | 'Shopping Malls'
  | 'Parks'
  | 'Cinema'
  | 'Bowling'
  | 'Billiards'
  | 'Football'
  | 'Sports Activities'
  | 'Supermarket Shopping'
  | 'Clothes Shopping'
  | 'City Tours'
  | 'Gaming Sessions'
  | 'Study Sessions'
  | 'Group Gatherings'
  | 'Custom Activities'
  | 'Outdoor Adventures';

// Fuel Cost Sharing Coordination details
export interface PickupRequest {
  id: string;
  passengerId: string;
  passengerName: string;
  passengerAvatar: string;
  pickupType: 'none' | 'my_location' | 'custom_location';
  customAddress?: string;
  googleMapsUrl?: string;
  lat?: number;
  lng?: number;
  status: 'pending' | 'accepted' | 'declined' | 'boarded';
  pickupOrder?: number; // Order in the route
}

export interface OutingLogistics {
  hasDriver: boolean;
  driverName?: string;
  driverId?: string;
  vehicleCapacity?: number;
  fuelSharingPrice?: number; // Total amount in local currency
  isCalculated: boolean;
  costPerPerson?: number;
  pickupPoint?: string;
  pickups?: PickupRequest[]; 
  isActivePickupMode?: boolean; // Toggle for pickup sequence
}

export interface BudgetEstimate {
  fuelCost: string;
  drinksCost: string;
  foodCost: string;
  entertainmentCost: string;
  totalCost: string;
  currency: string;
}

// Outing listing representation
export interface Outing {
  id: string;
  title: string;
  description: string;
  category: ActivityCategory;
  location: string; // E.g. Riyadh, Olaya District
  city: string; // Riyadh, Dubai, etc.
  datetime: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar: string;
  creatorTrust: number;
  maxAttendees: number;
  attendeeIds: string[];
  minTrustScore: number;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  logistics: OutingLogistics;
  coverImage?: string;
  genderRestriction: 'men_only' | 'women_only' | 'co_ed';
  mapCoordinates?: { lat: number; lng: number };
  mapLocationUrl?: string;
  placeId?: string;
  isBlindOuting?: boolean;
  blindWaypoints?: string[];
  isPrivate?: boolean; // If true, only invited riders can view/join
  invitedUserIds?: string[]; // Allowed user IDs for private outing
  isSoloOuting?: boolean; // Solo personal trip
  aiItinerarySteps?: string[]; // AI suggested itinerary steps
  currentStepIndex?: number; // Current active step in solo navigation
  budgetEstimate?: BudgetEstimate; // Real-time AI generated budget
}

export interface InterestCommunity {
  id: string; // 'cars' | 'football' | 'gaming' | 'photography' | 'trips'
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  icon: string;
  membersCount: number;
  members?: string[];
  timestamp?: string;
}

export interface CommunityMessage {
  id: string;
  communityId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  senderScore?: number;
  isVerified?: boolean;
  content: string;
  timestamp: string;
}

// Outing message for temporary chats
export interface Message {
  id: string;
  outingId: string;
  chatId?: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  timestamp: string;
  isSystem?: boolean;
  imageUrl?: string;
  locationUrl?: string;
  reactions?: Record<string, string>;
  isPinned?: boolean;
  is_pinned?: boolean;
  read?: boolean;
  is_read?: boolean;
  voiceUrl?: string;
  audioDuration?: number;
  type?: string;
}

// Post-outing Review details
export interface OutingReview {
  id: string;
  outingId: string;
  reviewerId: string;
  revieweeId: string;
  respectfulRating: number; // 1 to 5
  punctualRating: number; // 1 to 5
  paymentRating: number; // 1 to 5
  friendlyRating: number; // 1 to 5
  comment?: string;
  venueRating?: number; // 1 to 5
  hostRating?: number; // 1 to 5
}

// AI Matchmaker Recommendations
export interface AIRecommendation {
  title: string;
  description: string;
  primaryCategory: ActivityCategory;
  suggestedItinerary: string[];
  matchedArchetypes: string[];
  icebreakers: string[];
  savingsStrategy: string;
}

// Outing highlight micro-clips (Reels) shared by mates
export interface Reel {
  id: string;
  owner_id: string;
  video_url?: string;
  caption: string;
  creator_id: string;
  creator_name: string;
  creator_avatar: string;
  likes_count: number;
  comments_count: number;
  outing_id?: string;
  created_at?: string;
  
  // Transient frontend fields (snake_case)
  liked_by_ids?: string[];
  liked_by_user?: boolean;
  actual_location?: string;
  map_url?: string;
  views?: number;
}

export interface SocialPost {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar: string;
  type: 'image' | 'video' | 'review' | 'story';
  content: string;
  mediaUrl?: string;
  likedByIds: string[];
  commentsCount: number;
  timestamp: string;
  outingId?: string; // Linked outing
}

export interface SocialComment {
  id: string;
  targetId: string; // ID of Reel or SocialPost
  targetType: 'reel' | 'post';
  creatorId: string;
  creatorName: string;
  creatorAvatar: string;
  content: string;
  timestamp: string;
  replyToId?: string; // If this is a reply to another comment
}

export interface AppNotification {
  id: string;
  userId: string; // The owner of the notification
  type: 'like_post' | 'like_reel' | 'new_follower' | 'new_comment' | 'outing_invite' | 'outing_join_accepted' | 'friend_request' | 'friend_request_accepted' | 'direct_message';
  actorId: string;
  actorName: string;
  actorAvatar: string;
  targetId?: string; // post ID, reel ID, outing ID
  message: string;
  read: boolean;
  timestamp: string;
}

export interface PendingOperation {
  id: string;
  type: 'friendship' | 'message' | 'follow' | 'unfollow';
  payload: any;
  timestamp: string;
  retryCount: number;
  tableName: string;
}

// Full Database of Places
export interface DetailedPlace {
  id: string;
  nameEn: string;
  nameAr: string;
  city: string; // Riyadh, Jeddah, Dubai, Cairo, Amman
  category: 'Restaurants' | 'Cafes' | 'Parks' | 'Sights' | 'Malls' | 'Entertainment';
  classificationEn: 'Solo Friendly' | 'Group Gathering' | 'Family Optimized';
  classificationAr: 'مناسب للأفراد' | 'مناسب للمجموعات' | 'مناسب للعائلات';
  budget: 'low' | 'medium' | 'high'; // 💸, 💵, 💳
  rating: number;
  workingHoursEn: string;
  workingHoursAr: string;
  descriptionEn: string;
  descriptionAr: string;
  lat: number;
  lng: number;
  images: string[];
  servicesEn: string[];
  servicesAr: string[];
  reviews: { author: string; rating: number; commentAr: string; commentEn: string; avatar: string }[];
  googleMapsUrl?: string;
  placeId?: string;
}

