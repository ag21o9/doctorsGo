import { Router } from 'express';
import { prisma } from '../../configs/prisma.js';
import { attachUser, requireRole } from '../../middlewares/auth.js';

const router = Router();
router.use(attachUser(false), requireRole(['PATIENT']));

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// GET /api/patients/doctors/by-specialty/:specialty
// Returns all active doctors for the given specialty (no distance filtering)
router.get('/by-specialty/:specialty', async (req, res, next) => {
  try {
    const specialty = req.params.specialty;
    if (!specialty) return res.status(400).json({ error: 'specialty is required' });

    const doctors = await prisma.doctor.findMany({
      where: { isActive: true, specialties: { has: specialty } },
      include: {
        user: { select: { id: true, name: true } },
        services: { where: { specialty } },
      },
      orderBy: { yearsOfExperience: 'desc' },
      take: 200,
    });

    res.json(doctors);
  } catch (err) {
    next(err);
  }
});

// GET /api/patients/doctors/search?specialty=...&lat=&lng=&radiusKm=5&minPrice=&maxPrice=&mode=ONLINE|OFFLINE
// If lat/lng are not provided, uses patient's primary address coordinates (if available)
router.get('/search', async (req, res, next) => {
  try {
    const { specialty, lat, lng, radiusKm = 5, minPrice, maxPrice, mode } = req.query;
    if (!specialty) return res.status(400).json({ error: 'specialty query is required' });

    // Determine origin
    let originLat = lat != null ? parseFloat(lat) : undefined;
    let originLng = lng != null ? parseFloat(lng) : undefined;
    if (originLat == null || originLng == null) {
      const primary = await prisma.userAddress.findFirst({
        where: { userId: req.user.id, isPrimary: true },
        include: { address: true },
      });
      if (primary?.address?.latitude != null && primary?.address?.longitude != null) {
        originLat = primary.address.latitude;
        originLng = primary.address.longitude;
      }
    }

    // Fetch doctors with the given specialty
    const docs = await prisma.doctor.findMany({
      where: { isActive: true, specialties: { has: specialty } },
      include: {
        user: { select: { id: true, name: true } },
        services: { where: { specialty } },
      },
      take: 500,
    });

    const RAD = radiusKm != null ? parseFloat(radiusKm) : undefined;
    const minP = minPrice != null ? parseFloat(minPrice) : undefined;
    const maxP = maxPrice != null ? parseFloat(maxPrice) : undefined;
    const wantOnline = mode === 'ONLINE';
    const wantOffline = mode === 'OFFLINE';

    const results = [];
    for (const d of docs) {
      const svc = Array.isArray(d.services) && d.services.length ? d.services[0] : null;

      // Availability filter by mode
      if (mode) {
        if (wantOnline && !svc?.isOnlineAvailable) continue;
        if (wantOffline && !svc?.isHomeVisitAvailable) continue;
      }

      // Price filters
      if (minP != null && svc && Number(svc.basePrice) < minP) continue;
      if (maxP != null && svc && Number(svc.basePrice) > maxP) continue;

      // Distance filter if we have origin + doctor coords + radius
      let distanceKm = null;
      if (originLat != null && originLng != null && d.currentLocationLat != null && d.currentLocationLng != null) {
        distanceKm = haversineKm(originLat, originLng, d.currentLocationLat, d.currentLocationLng);
        if (RAD != null && distanceKm > RAD) continue;
      }

      results.push({
        id: d.id,
        userId: d.userId,
        name: d.user?.name ?? null,
        bio: d.bio ?? null,
        yearsOfExperience: d.yearsOfExperience ?? null,
        distanceKm: distanceKm != null ? Number(distanceKm.toFixed(2)) : null,
        service: svc,
      });
    }

    // Sort by distance first when available, otherwise by yearsOfExperience desc
    results.sort((a, b) => {
      if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm;
      if (a.distanceKm != null) return -1;
      if (b.distanceKm != null) return 1;
      return (b.yearsOfExperience || 0) - (a.yearsOfExperience || 0);
    });

    res.json({ origin: { lat: originLat ?? null, lng: originLng ?? null }, results });
  } catch (err) {
    next(err);
  }
});

export default router;
