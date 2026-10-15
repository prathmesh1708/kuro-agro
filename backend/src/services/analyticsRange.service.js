// Date ranges for the admin dashboard's period filter, in Indian Standard Time.
// Server clocks (and MongoDB's $dateToString) default to UTC, which would put orders placed between
// 00:00 and 05:30 IST on the previous day. IST has no daylight saving, so a fixed offset is exact.

export const TIMEZONE = 'Asia/Kolkata';
export const DASHBOARD_RANGES = ['today', 'yesterday', 'week', 'month', 'year'];

const OFFSET_MS = 330 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// IST calendar fields of an instant (read with getUTC* on the shifted date).
const ist = (date) => new Date(date.getTime() + OFFSET_MS);
// The instant of an IST wall-clock time.
const fromIst = (y, m, d = 1, h = 0) => new Date(Date.UTC(y, m, d, h) - OFFSET_MS);

const pad = (n) => String(n).padStart(2, '0');
const hourLabel = (h) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;

/**
 * Resolves a dashboard period to { start, end, prevStart, prevEnd, unit, format, buckets }.
 * - end is "now" for current periods, so the previous-period comparison covers the same elapsed time
 *   (e.g. today until 3 pm vs yesterday until 3 pm).
 * - buckets: [{ key, label }] for every hour / day / month in the range, matching `format` keys.
 */
export const resolveRange = (range, now = new Date()) => {
    const n = ist(now);
    const y = n.getUTCFullYear();
    const m = n.getUTCMonth();
    const d = n.getUTCDate();
    const startOfToday = fromIst(y, m, d);

    let start;
    let end = now;
    let prevStart;
    let prevEnd;
    let unit;

    switch (range) {
        case 'today':
            start = startOfToday;
            prevStart = new Date(start.getTime() - DAY);
            prevEnd = new Date(now.getTime() - DAY);
            unit = 'hour';
            break;
        case 'yesterday':
            start = new Date(startOfToday.getTime() - DAY);
            end = new Date(startOfToday.getTime() - 1);
            prevStart = new Date(start.getTime() - DAY);
            prevEnd = new Date(end.getTime() - DAY);
            unit = 'hour';
            break;
        case 'week': {
            const daysSinceMonday = (n.getUTCDay() + 6) % 7; // weeks start on Monday
            start = new Date(startOfToday.getTime() - daysSinceMonday * DAY);
            prevStart = new Date(start.getTime() - 7 * DAY);
            prevEnd = new Date(now.getTime() - 7 * DAY);
            unit = 'day';
            break;
        }
        case 'year':
            start = fromIst(y, 0, 1);
            prevStart = fromIst(y - 1, 0, 1);
            prevEnd = new Date(prevStart.getTime() + (now.getTime() - start.getTime()));
            unit = 'month';
            break;
        case 'month':
        default: {
            start = fromIst(y, m, 1);
            prevStart = fromIst(y, m - 1, 1);
            // Same elapsed time into last month, but never past its end (31 Mar vs 28 Feb).
            prevEnd = new Date(Math.min(prevStart.getTime() + (now.getTime() - start.getTime()), start.getTime() - 1));
            unit = 'day';
            break;
        }
    }

    const format = { hour: '%Y-%m-%d %H', day: '%Y-%m-%d', month: '%Y-%m' }[unit];
    const buckets = [];
    if (unit === 'hour') {
        for (let t = start.getTime(); t <= end.getTime(); t += HOUR) {
            const b = ist(new Date(t));
            buckets.push({ key: `${b.getUTCFullYear()}-${pad(b.getUTCMonth() + 1)}-${pad(b.getUTCDate())} ${pad(b.getUTCHours())}`, label: hourLabel(b.getUTCHours()) });
        }
    } else if (unit === 'day') {
        for (let t = start.getTime(); t <= end.getTime(); t += DAY) {
            const b = ist(new Date(t));
            buckets.push({
                key: `${b.getUTCFullYear()}-${pad(b.getUTCMonth() + 1)}-${pad(b.getUTCDate())}`,
                label: range === 'week' ? `${WEEKDAYS[b.getUTCDay()]} ${b.getUTCDate()}` : `${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]}`,
            });
        }
    } else {
        for (let month = 0; month <= m; month += 1) {
            buckets.push({ key: `${y}-${pad(month + 1)}`, label: MONTHS[month] });
        }
    }

    return { range: DASHBOARD_RANGES.includes(range) ? range : 'month', start, end, prevStart, prevEnd, unit, format, buckets };
};

/** $dateToString expression that groups `field` into the range's buckets in IST. */
export const bucketExpr = (format, field = '$createdAt') => ({ $dateToString: { format, date: field, timezone: TIMEZONE } });

/** Percentage change from `previous` to `current`, one decimal; null when there is nothing to compare with. */
export const percentChange = (current, previous) => {
    if (!previous) return null;
    return Math.round(((current - previous) / previous) * 1000) / 10;
};
