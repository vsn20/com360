// utils/rateLimiter.js
const emailAttempts = new Map();

export function checkEmailRateLimit(email, maxAttempts = 3, windowMs = 600000) {
  const now = Date.now();
  const attempts = emailAttempts.get(email) || [];
  
  // Remove old attempts outside the time window
  const recentAttempts = attempts.filter(time => now - time < windowMs);
  
  if (recentAttempts.length >= maxAttempts) {
    const oldestAttempt = Math.min(...recentAttempts);
    const waitTime = Math.ceil((windowMs - (now - oldestAttempt)) / 60000);
    return { allowed: false, waitTime };
  }
  
  recentAttempts.push(now);
  emailAttempts.set(email, recentAttempts);
  return { allowed: true };
}

// Cleanup old entries every hour to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, times] of emailAttempts.entries()) {
    const recent = times.filter(t => now - t < 600000);
    if (recent.length === 0) {
      emailAttempts.delete(key);
    } else {
      emailAttempts.set(key, recent);
    }
  }
}, 3600000);