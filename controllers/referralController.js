
import User from "../models/userSchema.js";
import Referral from "../models/Referral.js";
import Wallet from "../models/Wallet.js";


export const getReferralPage = async (req, res) => {
    try {
        const userId = req.session.userId;
        
        if (!userId) {
            req.flash('error', 'Please login to view referral program');
            return res.redirect('/login');
        }

        const user = await User.findById(userId)
            .select('fullName referralCode referralLink referralPoints totalReferrals referralEarnings referralStats');
        
        if (!user) {
            req.flash('error', 'User not found');
            return res.redirect('/login');
        }

       
        const referrals = await Referral.find({ referrer: userId })
            .populate('referredUser', 'fullName email createdAt')
            .sort({ createdAt: -1 });

       
        const wallet = await Wallet.findOne({ user: userId });
        const walletBalance = wallet ? wallet.balance : 0;

        res.render('user/pages/referrals', {
             pageJs: "referral.js",
            user: {
                ...user.toObject(),
                walletBalance
            },
            referrals,
            referralBonus: 100,
            totalEarned: user.referralEarnings || 0,
            pendingEarnings: referrals.filter(r => r.status === 'pending').length * 100,
            baseUrl: process.env.BASE_URL || 'http://localhost:3000'
        });

    } catch (error) {
        console.error('Referral page error:', error);
        req.flash('error', 'Error loading referral page');
        res.redirect('/');
    }
};


export const processReferralSignup = async (referralCode, newUserId) => {
    try {
        console.log('Processing referral for new user:', newUserId, 'with code:', referralCode);
        
     
        const referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
        
        if (!referrer) {
            console.log('Referrer not found for code:', referralCode);
            return null;
        }

 
        const existingReferral = await Referral.findOne({ referredUser: newUserId });
        if (existingReferral) {
            console.log('Referral already exists for this user');
            return existingReferral;
        }

      
        const referral = await Referral.create({
            referrer: referrer._id,
            referredUser: newUserId,
            referralCode: referralCode.toUpperCase(),
            status: 'pending',
            rewardAmount: 100,
            rewardType: 'cash',
            conditions: {
                signupBonus: true,
                firstPurchase: false
            }
        });

        console.log('Referral record created:', referral._id);

    
        await User.findByIdAndUpdate(referrer._id, {
            $inc: { 
                totalReferrals: 1,
                'referralStats.totalReferred': 1,
                'referralStats.pendingReferrals': 1
            }
        });

    
        await User.findByIdAndUpdate(newUserId, {
            referredBy: referrer._id
        });

        return referral;

    } catch (error) {
        console.error('Process referral signup error:', error);
        throw error;
    }
};


export const completeReferral = async (userId) => {
    try {
        console.log('Completing referral for user:', userId);
        
     
        const referral = await Referral.findOne({ 
            referredUser: userId, 
            status: 'pending' 
        });

        if (!referral) {
            console.log('No pending referral found for user:', userId);
            return null;
        }

       
        referral.status = 'completed';
        referral.rewardStatus = 'credited';
        referral.creditedAt = new Date();
        referral.conditions.firstPurchase = true;
        await referral.save();

      
        const referrerWallet = await Wallet.findOne({ user: referral.referrer });
        
        if (!referrerWallet) {
           
            await Wallet.create({
                user: referral.referrer,
                balance: 100,
                transactions: [{
                    amount: 100,
                    type: 'credit',
                    description: `Referral bonus for ${referral.referredUser}`,
                    status: 'success',
                    payment_method: 'referral',
                    referral_id: referral._id,
                    referred_user: userId,
                    createdAt: new Date()
                }]
            });
        } else {
          
            referrerWallet.balance += 100;
            referrerWallet.transactions.push({
                amount: 100,
                type: 'credit',
                description: `Referral bonus for user signup`,
                status: 'success',
                payment_method: 'referral',
                referral_id: referral._id,
                referred_user: userId,
                createdAt: new Date()
            });
            await referrerWallet.save();
        }

       
        await User.findByIdAndUpdate(referral.referrer, {
            $inc: { 
                referralPoints: 100,
                referralEarnings: 100,
                'referralStats.successfulReferrals': 1,
                'referralStats.pendingReferrals': -1
            }
        });

        console.log('Referral completed successfully for user:', userId);
        return referral;

    } catch (error) {
        console.error('Complete referral error:', error);
        throw error;
    }
};


export const getReferralStats = async (req, res) => {
    try {
        const userId = req.session.userId;
        
        if (!userId) {
            return res.json({ success: false, message: 'Not logged in' });
        }

        const user = await User.findById(userId)
            .select('referralCode referralLink referralPoints totalReferrals referralEarnings referralStats');
        
        const referrals = await Referral.find({ referrer: userId })
            .populate('referredUser', 'fullName email createdAt profilePicture')
            .sort({ createdAt: -1 })
            .limit(10);

        const wallet = await Wallet.findOne({ user: userId });
        const walletBalance = wallet ? wallet.balance : 0;

        res.json({
            success: true,
            data: {
                user,
                referrals,
                walletBalance,
                referralBonus: 100,
                totalEarned: user.referralEarnings || 0
            }
        });

    } catch (error) {
        console.error('Get referral stats error:', error);
        res.json({ success: false, message: 'Error getting referral stats' });
    }
};


export const copyReferralLink = async (req, res) => {
    try {
        const userId = req.session.userId;
        
        if (!userId) {
            return res.json({ success: false, message: 'Not logged in' });
        }

        const user = await User.findById(userId).select('referralLink');
        
        res.json({
            success: true,
            message: 'Referral link copied to clipboard',
            data: {
                referralLink: user.referralLink
            }
        });

    } catch (error) {
        console.error('Copy referral link error:', error);
        res.json({ success: false, message: 'Error copying link' });
    }
};