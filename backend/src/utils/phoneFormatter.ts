export const formatPhoneNumber = (phone: string): string => {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Handle Israeli numbers
  if (cleaned.startsWith('0')) {
    // Remove leading 0 and add 972
    cleaned = '972' + cleaned.substring(1);
  } else if (cleaned.startsWith('972')) {
    // Already in correct format
  } else if (cleaned.startsWith('+972')) {
    cleaned = cleaned.substring(1);
  } else if (cleaned.length === 9) {
    // Assume Israeli number without prefix
    cleaned = '972' + cleaned;
  }
  
  return cleaned + '@c.us';
};

export const isValidPhoneNumber = (phone: string): boolean => {
  const cleaned = phone.replace(/\D/g, '');
  // Israeli numbers should be 9-12 digits
  return cleaned.length >= 9 && cleaned.length <= 12;
};

export const formatDisplayPhone = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('972')) {
    const local = '0' + cleaned.substring(3);
    return local.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  }
  
  return phone;
};
