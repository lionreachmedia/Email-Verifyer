const Verification = require('../models/Verification');

exports.stats = async (req, res) => {
  const userId = req.user._id;
  const [byStatus, avg] = await Promise.all([
    Verification.aggregate([{ $match: { userId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Verification.aggregate([{ $match: { userId, confidence: { $ne: null } } }, { $group: { _id: null, avg: { $avg: '$confidence' } } }]),
  ]);
  const counts = { valid: 0, invalid: 0, risky: 0, 'catch-all': 0, unknown: 0 };
  byStatus.forEach(({ _id, count }) => { if (_id in counts) counts[_id] = count; });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  res.json({ success: true, data: { total, avgConfidence: Math.round(avg[0]?.avg || 0), byStatus: counts } });
};

exports.chart = async (req, res) => {
  const userId = req.user._id;
  const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 14));
  const since = new Date(Date.now() - days * 86400000);
  const [daily, topDomains] = await Promise.all([
    Verification.aggregate([
      { $match: { userId, createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
          valid: { $sum: { $cond: [{ $eq: ['$status', 'valid'] }, 1, 0] } },
          invalid: { $sum: { $cond: [{ $eq: ['$status', 'invalid'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Verification.aggregate([
      { $match: { userId } },
      { $group: { _id: { $arrayElemAt: [{ $split: ['$email', '@'] }, 1] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
  ]);
  res.json({ success: true, data: { daily, topDomains } });
};
