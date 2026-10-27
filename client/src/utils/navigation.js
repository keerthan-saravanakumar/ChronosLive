export function authDestination(account, returnTo) {
  if (typeof returnTo === 'string' && returnTo.startsWith('/') && !returnTo.startsWith('//')) return returnTo;
  if (account.role === 'organizer') return '/organizer';
  if (account.role === 'admin') return '/admin';
  return '/browse';
}
