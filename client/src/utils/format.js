import { format, addDays } from 'date-fns';
export const dateLabel = value => format(new Date(value), 'EEE, d MMM yyyy');
export const timeLabel = value => format(new Date(value), 'h:mm a');
export const shortDate = value => format(new Date(value), 'd MMM');
export const localDate = value => format(value ? new Date(value) : new Date(), 'yyyy-MM-dd');
export const dayStart = date => new Date(date + 'T00:00:00').toISOString();
export const dayEnd = date => addDays(new Date(date + 'T00:00:00'), 1).toISOString();
export const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
export const initials = name => (name || '?').split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();
export const idOf = value => value?._id || value;
export const refreshData = () => window.dispatchEvent(new CustomEvent('chronos:refresh'));
export const errorCode = error => error.response?.data?.error?.code;
export function errorMessage(error) {
  const code = errorCode(error);
  const messages = {
    SLOT_FULL: 'Just filled up. Join the waitlist for the next available seat.',
    TIME_CONFLICT: 'You already have a booking that overlaps this time.',
    BOOKING_LIMIT_REACHED: 'You have reached this service’s upcoming booking limit.',
    CANCELLATION_WINDOW_CLOSED: 'It is too close to the start time to cancel. Please contact the organizer.',
    CAPACITY_BELOW_BOOKED: 'Capacity must cover everyone already booked.',
    SERVICE_INACTIVE: 'This service is archived. Existing bookings are still valid.',
    ALREADY_BOOKED: 'You already have a seat for this session.',
    ALREADY_ON_WAITLIST: 'You are already on this waitlist.',
    SLOT_HAS_SEATS: 'A seat is available now. Book it directly.',
    OWN_SLOT: 'You cannot reserve a place in your own session.',
    RATE_LIMITED: 'Please wait a little before trying again.',
  };
  return messages[code] || error.response?.data?.error?.message || (error.code === 'ECONNABORTED' ? 'This is taking longer than usual. Please try again.' : 'Could not connect. Check your connection and try again.');
}
