export interface FieldAction {
  id: string;
  name: string;
  cardProductId: string;
  city: string;
  startsAt: string;
  endsAt: string | null;
  isActive: boolean;
}

export interface FieldActionMember {
  fieldActionId: string;
  profileId: string;
}
