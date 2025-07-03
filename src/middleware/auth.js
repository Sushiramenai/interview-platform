const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

class AuthMiddleware {
    static generateToken(payload) {
        return jwt.sign(payload, process.env.JWT_SECRET || 'default-secret', {
            expiresIn: '24h'
        });
    }

    static verifyToken(token) {
        try {
            return jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
        } catch (error) {
            return null;
        }
    }

    static async hashPassword(password) {
        return bcrypt.hash(password, 10);
    }

    static async comparePassword(password, hash) {
        return bcrypt.compare(password, hash);
    }

    static requireAuth(req, res, next) {
        const token = req.cookies?.authToken || req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const decoded = AuthMiddleware.verifyToken(token);
        if (!decoded) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        req.user = decoded;
        next();
    }

    static requireAdmin(req, res, next) {
        AuthMiddleware.requireAuth(req, res, () => {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Admin access required' });
            }
            next();
        });
    }

    static async initializeAdmin() {
        // Fixed admin credentials for initial setup
        const adminEmail = 'Admin';
        const adminPassword = 'admin123';

        const hashedPassword = await AuthMiddleware.hashPassword(adminPassword);
        
        console.log('Admin user initialized:', adminEmail);
        return {
            email: adminEmail,
            username: adminEmail,
            password: hashedPassword,
            role: 'admin'
        };
    }
}

module.exports = AuthMiddleware;