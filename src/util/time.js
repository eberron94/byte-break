function getTimeContext() {
    const now = new Date();
    const hour = now.getHours();
    let timePhase = 'night';
    if (hour >= 6 && hour < 18) timePhase = 'day';
    else if (hour >= 18 && hour < 21) timePhase = 'evening';

    return { timePhase, dayOfWeek: now.getDay() };
}

module.exports = { getTimeContext };