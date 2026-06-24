const twilio = require('twilio');
const sgMail = require('@sendgrid/mail');
const { query } = require('../config/database');

class NotificationService {
  constructor() {
    // Initialize Twilio for SMS
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    }

    // Initialize SendGrid for email
    if (process.env.SENDGRID_API_KEY) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    }
  }

  // Create notification in database
  async createNotification(userId, issueId, type, title, message) {
    try {
      const result = await query(`
        INSERT INTO notifications (user_id, issue_id, type, title, message)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, created_at
      `, [userId, issueId, type, title, message]);

      return {
        success: true,
        notificationId: result.rows[0].id,
        createdAt: result.rows[0].created_at
      };
    } catch (error) {
      console.error('Create notification error:', error);
      throw error;
    }
  }

  // Send SMS notification
  async sendSMS(phoneNumber, message) {
    try {
      if (!this.twilioClient) {
        console.log('Twilio not configured, skipping SMS');
        return { success: false, error: 'SMS service not configured' };
      }

      const result = await this.twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });

      return {
        success: true,
        messageId: result.sid
      };
    } catch (error) {
      console.error('SMS sending error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Send email notification
  async sendEmail(email, subject, message, htmlMessage = null) {
    try {
      if (!process.env.SENDGRID_API_KEY) {
        console.log('SendGrid not configured, skipping email');
        return { success: false, error: 'Email service not configured' };
      }

      const msg = {
        to: email,
        from: process.env.FROM_EMAIL || 'noreply@civicissues.gov.in',
        subject: subject,
        text: message,
        html: htmlMessage || message
      };

      await sgMail.send(msg);

      return {
        success: true,
        message: 'Email sent successfully'
      };
    } catch (error) {
      console.error('Email sending error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Send push notification (placeholder for future implementation)
  async sendPushNotification(userId, title, message, data = {}) {
    try {
      // This would integrate with Firebase Cloud Messaging or similar
      // For now, we'll just log it
      console.log(`Push notification for user ${userId}: ${title} - ${message}`);
      
      return {
        success: true,
        message: 'Push notification queued'
      };
    } catch (error) {
      console.error('Push notification error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Notify issue status update
  async notifyIssueStatusUpdate(issueId, oldStatus, newStatus, reason = null) {
    try {
      // Get issue and reporter details
      const issueResult = await query(`
        SELECT 
          i.title, i.description, i.category,
          u.id as reporter_id, u.first_name, u.last_name, u.email, u.phone
        FROM issues i
        JOIN users u ON i.reporter_id = u.id
        WHERE i.id = $1
      `, [issueId]);

      if (issueResult.rows.length === 0) {
        throw new Error('Issue not found');
      }

      const issue = issueResult.rows[0];
      const reporterName = `${issue.first_name} ${issue.last_name}`;

      // Create notification
      const title = `Issue Status Updated to ${this.capitalizeFirst(newStatus)}`;
      const message = `Your issue "${issue.title}" status has been updated from ${oldStatus} to ${newStatus}. ${reason ? 'Reason: ' + reason : ''}`;

      await this.createNotification(
        issue.reporter_id,
        issueId,
        'status_update',
        title,
        message
      );

      // Send email notification
      const emailSubject = `Civic Issue Update: ${issue.title}`;
      const emailMessage = `
        Dear ${reporterName},
        
        Your civic issue has been updated:
        
        Issue: ${issue.title}
        Category: ${this.capitalizeFirst(issue.category.replace('_', ' '))}
        Status: ${oldStatus} → ${newStatus}
        ${reason ? 'Reason: ' + reason : ''}
        
        You can view the full details and track progress on our platform.
        
        Thank you for helping improve our community!
        
        Best regards,
        Civic Issue Management System
      `;

      await this.sendEmail(issue.email, emailSubject, emailMessage);

      // Send SMS notification for critical updates
      if (newStatus === 'resolved' || newStatus === 'rejected') {
        const smsMessage = `Your civic issue "${issue.title}" has been ${newStatus}. Check the platform for details.`;
        await this.sendSMS(issue.phone, smsMessage);
      }

      return {
        success: true,
        message: 'Status update notifications sent'
      };
    } catch (error) {
      console.error('Status update notification error:', error);
      throw error;
    }
  }

  // Notify new issue assignment
  async notifyIssueAssignment(issueId, assignedAdminId) {
    try {
      // Get issue and admin details
      const result = await query(`
        SELECT 
          i.title, i.description, i.category, i.priority,
          u.first_name, u.last_name, u.email, u.phone
        FROM issues i
        JOIN users u ON i.reporter_id = u.id
        WHERE i.id = $1
      `, [issueId]);

      if (result.rows.length === 0) {
        throw new Error('Issue not found');
      }

      const issue = result.rows[0];
      const adminName = `${issue.first_name} ${issue.last_name}`;

      // Create notification for admin
      const title = 'New Issue Assigned';
      const message = `You have been assigned a new issue: "${issue.title}" (Priority: ${issue.priority})`;

      await this.createNotification(
        assignedAdminId,
        issueId,
        'assignment',
        title,
        message
      );

      // Send email to admin
      const emailSubject = `New Issue Assignment: ${issue.title}`;
      const emailMessage = `
        Dear ${adminName},
        
        You have been assigned a new civic issue:
        
        Title: ${issue.title}
        Category: ${this.capitalizeFirst(issue.category.replace('_', ' '))}
        Priority: ${issue.priority}
        Description: ${issue.description}
        
        Please log in to the admin dashboard to review and take action.
        
        Best regards,
        Civic Issue Management System
      `;

      await this.sendEmail(issue.email, emailSubject, emailMessage);

      return {
        success: true,
        message: 'Assignment notification sent'
      };
    } catch (error) {
      console.error('Assignment notification error:', error);
      throw error;
    }
  }

  // Notify new comment
  async notifyNewComment(issueId, commenterId, comment) {
    try {
      // Get issue details and all users following this issue
      const result = await query(`
        SELECT 
          i.title, i.reporter_id,
          u.first_name, u.last_name, u.email, u.phone
        FROM issues i
        JOIN users u ON i.reporter_id = u.id
        WHERE i.id = $1
      `, [issueId]);

      if (result.rows.length === 0) {
        throw new Error('Issue not found');
      }

      const issue = result.rows[0];
      const reporterId = issue.reporter_id;

      // Don't notify the commenter themselves
      if (commenterId === reporterId) {
        return { success: true, message: 'No notification needed' };
      }

      // Get commenter details
      const commenterResult = await query(
        'SELECT first_name, last_name FROM users WHERE id = $1',
        [commenterId]
      );

      if (commenterResult.rows.length === 0) {
        throw new Error('Commenter not found');
      }

      const commenterName = `${commenterResult.rows[0].first_name} ${commenterResult.rows[0].last_name}`;

      // Create notification for reporter
      const title = 'New Comment on Your Issue';
      const message = `${commenterName} commented on your issue "${issue.title}": "${comment}"`;

      await this.createNotification(
        reporterId,
        issueId,
        'new_comment',
        title,
        message
      );

      return {
        success: true,
        message: 'Comment notification sent'
      };
    } catch (error) {
      console.error('Comment notification error:', error);
      throw error;
    }
  }

  // Notify new upvote
  async notifyNewUpvote(issueId, voterId) {
    try {
      // Get issue and reporter details
      const result = await query(`
        SELECT 
          i.title, i.reporter_id,
          u.first_name, u.last_name, u.email
        FROM issues i
        JOIN users u ON i.reporter_id = u.id
        WHERE i.id = $1
      `, [issueId]);

      if (result.rows.length === 0) {
        throw new Error('Issue not found');
      }

      const issue = result.rows[0];
      const reporterId = issue.reporter_id;

      // Don't notify the voter themselves
      if (voterId === reporterId) {
        return { success: true, message: 'No notification needed' };
      }

      // Get voter details
      const voterResult = await query(
        'SELECT first_name, last_name FROM users WHERE id = $1',
        [voterId]
      );

      if (voterResult.rows.length === 0) {
        throw new Error('Voter not found');
      }

      const voterName = `${voterResult.rows[0].first_name} ${voterResult.rows[0].last_name}`;

      // Create notification for reporter
      const title = 'Your Issue Received Support';
      const message = `${voterName} upvoted your issue "${issue.title}". Your issue is gaining community support!`;

      await this.createNotification(
        reporterId,
        issueId,
        'upvote',
        title,
        message
      );

      return {
        success: true,
        message: 'Upvote notification sent'
      };
    } catch (error) {
      console.error('Upvote notification error:', error);
      throw error;
    }
  }

  // Get user notifications
  async getUserNotifications(userId, page = 1, limit = 20) {
    try {
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const result = await query(`
        SELECT 
          n.*,
          i.title as issue_title,
          i.category as issue_category
        FROM notifications n
        LEFT JOIN issues i ON n.issue_id = i.id
        WHERE n.user_id = $1
        ORDER BY n.created_at DESC
        LIMIT $2 OFFSET $3
      `, [userId, parseInt(limit), offset]);

      // Get total count
      const countResult = await query(
        'SELECT COUNT(*) FROM notifications WHERE user_id = $1',
        [userId]
      );

      const totalCount = parseInt(countResult.rows[0].count);

      return {
        success: true,
        data: {
          notifications: result.rows,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalCount / parseInt(limit)),
            totalCount: totalCount,
            hasNext: offset + parseInt(limit) < totalCount,
            hasPrev: parseInt(page) > 1
          }
        }
      };
    } catch (error) {
      console.error('Get notifications error:', error);
      throw error;
    }
  }

  // Mark notification as read
  async markNotificationAsRead(notificationId, userId) {
    try {
      const result = await query(`
        UPDATE notifications 
        SET is_read = true, read_at = CURRENT_TIMESTAMP 
        WHERE id = $1 AND user_id = $2
        RETURNING id
      `, [notificationId, userId]);

      if (result.rows.length === 0) {
        throw new Error('Notification not found or access denied');
      }

      return {
        success: true,
        message: 'Notification marked as read'
      };
    } catch (error) {
      console.error('Mark notification read error:', error);
      throw error;
    }
  }

  // Mark all notifications as read
  async markAllNotificationsAsRead(userId) {
    try {
      await query(`
        UPDATE notifications 
        SET is_read = true, read_at = CURRENT_TIMESTAMP 
        WHERE user_id = $1 AND is_read = false
      `, [userId]);

      return {
        success: true,
        message: 'All notifications marked as read'
      };
    } catch (error) {
      console.error('Mark all notifications read error:', error);
      throw error;
    }
  }

  // Get unread notification count
  async getUnreadCount(userId) {
    try {
      const result = await query(
        'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
        [userId]
      );

      return {
        success: true,
        count: parseInt(result.rows[0].count)
      };
    } catch (error) {
      console.error('Get unread count error:', error);
      throw error;
    }
  }

  // Utility function to capitalize first letter
  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // Send bulk notifications (for announcements)
  async sendBulkNotification(userIds, title, message, type = 'announcement') {
    try {
      const notifications = [];
      
      for (const userId of userIds) {
        notifications.push([
          userId,
          null, // No specific issue
          type,
          title,
          message
        ]);
      }

      // Batch insert notifications
      const values = notifications.map((_, index) => {
        const offset = index * 5;
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`;
      }).join(', ');

      const flatParams = notifications.flat();

      await query(`
        INSERT INTO notifications (user_id, issue_id, type, title, message)
        VALUES ${values}
      `, flatParams);

      return {
        success: true,
        message: `Bulk notification sent to ${userIds.length} users`
      };
    } catch (error) {
      console.error('Bulk notification error:', error);
      throw error;
    }
  }
}

module.exports = new NotificationService();
