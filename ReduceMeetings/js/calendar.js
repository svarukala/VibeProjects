/**
 * Calendar Analysis Module
 *
 * Handles calendar data retrieval and analysis of recurring meetings
 */

import graphClient from './graph.js';

class CalendarAnalyzer {
    constructor() {
        this.recurringMeetings = [];
        this.meetingChats = new Map();
    }

    /**
     * Calculate date range based on months to analyze
     */
    getDateRange(months) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - months);

        return { startDate, endDate };
    }

    /**
     * Analyze recurring meetings within the specified date range
     */
    async analyzeRecurringMeetings(months, progressCallback = null) {
        const { startDate, endDate } = this.getDateRange(months);

        if (progressCallback) {
            progressCallback({ stage: 'fetching', message: 'Fetching calendar events...' });
        }

        // Get all recurring meetings
        const recurringMeetings = await graphClient.getRecurringEvents(startDate, endDate);

        if (progressCallback) {
            progressCallback({
                stage: 'processing',
                message: `Found ${recurringMeetings.length} recurring meetings. Processing...`,
                total: recurringMeetings.length
            });
        }

        // Process each recurring meeting
        const analyzedMeetings = [];

        for (let i = 0; i < recurringMeetings.length; i++) {
            const meeting = recurringMeetings[i];

            if (progressCallback) {
                progressCallback({
                    stage: 'analyzing',
                    message: `Analyzing: ${meeting.subject}`,
                    current: i + 1,
                    total: recurringMeetings.length
                });
            }

            const analysis = await this.analyzeMeeting(meeting, startDate, endDate);
            analyzedMeetings.push(analysis);
        }

        this.recurringMeetings = analyzedMeetings;

        if (progressCallback) {
            progressCallback({
                stage: 'complete',
                message: `Analysis complete. ${analyzedMeetings.length} meetings analyzed.`
            });
        }

        return {
            dateRange: { startDate, endDate },
            monthsAnalyzed: months,
            meetings: analyzedMeetings
        };
    }

    /**
     * Analyze a single recurring meeting
     */
    async analyzeMeeting(meeting, startDate, endDate) {
        const instances = meeting.instances || [];
        const totalInstances = instances.length;

        // Calculate attendance (based on response status)
        const attendanceData = this.calculateAttendance(instances);

        // Get chat engagement data
        const chatData = await this.getChatEngagement(meeting);

        // Build the meeting analysis object
        return {
            id: meeting.seriesMasterId,
            seriesMasterId: meeting.seriesMasterId,
            subject: meeting.subject || 'No Subject',
            organizer: {
                name: meeting.organizer?.emailAddress?.name || 'Unknown',
                email: meeting.organizer?.emailAddress?.address || ''
            },
            onlineMeetingUrl: meeting.onlineMeeting?.joinUrl || null,
            recurrencePattern: this.getRecurrencePattern(instances),
            totalInstances: totalInstances,
            engagement: {
                timesAttended: attendanceData.attended,
                timesMissed: attendanceData.missed,
                timesDeclined: attendanceData.declined,
                timesTentative: attendanceData.tentative,
                attendanceRate: totalInstances > 0
                    ? (attendanceData.attended / totalInstances)
                    : 0,
                chatMessagesCount: chatData.messagesCount,
                mentionsCount: chatData.mentionsCount,
                lastInstance: instances.length > 0
                    ? instances[instances.length - 1].start?.dateTime
                    : null
            },
            instances: instances.map(inst => ({
                id: inst.id,
                start: inst.start?.dateTime,
                end: inst.end?.dateTime,
                responseStatus: inst.responseStatus?.response || 'none'
            })),
            recommendation: null // Will be filled by OpenAI analysis
        };
    }

    /**
     * Calculate attendance from meeting instances
     */
    calculateAttendance(instances) {
        const attendance = {
            attended: 0,
            missed: 0,
            declined: 0,
            tentative: 0
        };

        for (const instance of instances) {
            const status = instance.responseStatus?.response?.toLowerCase() || 'none';

            switch (status) {
                case 'accepted':
                case 'organizer':
                    attendance.attended++;
                    break;
                case 'declined':
                    attendance.declined++;
                    break;
                case 'tentativelyaccepted':
                case 'tentative':
                    attendance.tentative++;
                    break;
                case 'notresponded':
                case 'none':
                default:
                    // For past events with no response, consider as missed
                    const instanceDate = new Date(instance.start?.dateTime);
                    if (instanceDate < new Date()) {
                        attendance.missed++;
                    }
                    break;
            }
        }

        return attendance;
    }

    /**
     * Get chat engagement data for a meeting
     */
    async getChatEngagement(meeting) {
        try {
            // This is a simplified version - actual implementation would
            // match meeting chats with calendar events
            const chats = await graphClient.getMeetingChats();

            // Try to find a chat that matches this meeting
            const meetingChat = chats.find(chat =>
                chat.topic?.toLowerCase().includes(meeting.subject?.toLowerCase())
            );

            if (!meetingChat) {
                return { messagesCount: 0, mentionsCount: 0 };
            }

            const messages = await graphClient.getChatMessages(meetingChat.id);

            // Count user's messages and mentions
            const userEmail = meeting.organizer?.emailAddress?.address;
            let messagesCount = 0;
            let mentionsCount = 0;

            for (const msg of messages) {
                // Count messages from the user
                if (msg.from?.user?.displayName) {
                    messagesCount++;
                }

                // Count mentions
                if (msg.mentions && msg.mentions.length > 0) {
                    mentionsCount += msg.mentions.length;
                }
            }

            return { messagesCount, mentionsCount };
        } catch (error) {
            console.warn('Could not fetch chat engagement:', error);
            return { messagesCount: 0, mentionsCount: 0 };
        }
    }

    /**
     * Determine the recurrence pattern from instances
     */
    getRecurrencePattern(instances) {
        if (instances.length < 2) return 'Unknown';

        const first = new Date(instances[0].start?.dateTime);
        const second = new Date(instances[1].start?.dateTime);
        const diffDays = Math.round((second - first) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) return 'Daily';
        if (diffDays === 7) return 'Weekly';
        if (diffDays >= 14 && diffDays <= 15) return 'Bi-weekly';
        if (diffDays >= 28 && diffDays <= 31) return 'Monthly';

        return `Every ${diffDays} days`;
    }

    /**
     * Get summary statistics
     */
    getSummary() {
        const total = this.recurringMeetings.length;
        const byRecommendation = {
            keep: 0,
            remove: 0,
            follow: 0,
            pending: 0
        };

        let totalAttendanceRate = 0;

        for (const meeting of this.recurringMeetings) {
            totalAttendanceRate += meeting.engagement.attendanceRate;

            const action = meeting.recommendation?.action?.toLowerCase();
            if (action && byRecommendation.hasOwnProperty(action)) {
                byRecommendation[action]++;
            } else {
                byRecommendation.pending++;
            }
        }

        return {
            totalMeetings: total,
            averageAttendanceRate: total > 0 ? totalAttendanceRate / total : 0,
            recommendations: byRecommendation
        };
    }

    /**
     * Get meetings filtered by recommendation
     */
    getMeetingsByRecommendation(action) {
        if (!action || action === 'all') {
            return this.recurringMeetings;
        }

        return this.recurringMeetings.filter(
            m => m.recommendation?.action?.toLowerCase() === action.toLowerCase()
        );
    }

    /**
     * Get a single meeting by ID
     */
    getMeetingById(id) {
        return this.recurringMeetings.find(m => m.id === id || m.seriesMasterId === id);
    }
}

// Export singleton instance
const calendarAnalyzer = new CalendarAnalyzer();
export default calendarAnalyzer;
