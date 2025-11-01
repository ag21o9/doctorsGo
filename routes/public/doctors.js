import { Router } from 'express';
import { prisma } from '../../configs/prisma.js';

const router = Router();

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// GET /api/public/doctors/:id
router.get('/:id', async (req, res, next) => {
  try {
    const doc = await prisma.doctor.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, name: true } },
        services: true,
        hospitalLinks: { include: { hospital: true } },
      },
    });
    if (!doc) return res.status(404).json({ error: 'Doctor not found' });
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

// GET /api/public/doctors/search?lat=&lng=&radiusKm=5&specialty=&minPrice=&maxPrice=
router.get('/', async (req, res, next) => {
  try {
    const { lat, lng, radiusKm = 5, specialty, minPrice, maxPrice } = req.query;

    if (lat == null || lng == null) {
      return res.status(400).json({ error: 'lat and lng are required' });
    }

    const spec = specialty || undefined;

    // Fetch potential doctors, include services for price filtering
    const docs = await prisma.doctor.findMany({
      where: {
        isActive: true,
        ...(spec ? { specialties: { has: spec } } : {}),
      },
      include: {
        services: spec
          ? { where: { specialty: spec } }
          : true,
      },
    });

    const LAT = parseFloat(lat);
    const LNG = parseFloat(lng);
    const RAD = parseFloat(radiusKm);
    const minP = minPrice ? parseFloat(minPrice) : undefined;
    const maxP = maxPrice ? parseFloat(maxPrice) : undefined;

    const enriched = [];
    for (const d of docs) {
      const dlat = d.currentLocationLat;
      const dlng = d.currentLocationLng;
      if (dlat == null || dlng == null) continue; // skip if no coordinates

      const dist = haversineKm(LAT, LNG, dlat, dlng);
      if (dist > RAD) continue;

      const services = (Array.isArray(d.services) ? d.services : []);
      const filteredServices = services.filter((s) => {
        if (spec && s.specialty !== spec) return false;
        if (minP != null && Number(s.basePrice) < minP) return false;
        if (maxP != null && Number(s.basePrice) > maxP) return false;
        return true;
      });
      if (spec && filteredServices.length === 0) continue;

      enriched.push({
        id: d.id,
        userId: d.userId,
        name: undefined, // can join with user in a second query if needed
        bio: d.bio,
        yearsOfExperience: d.yearsOfExperience,
        distanceKm: Number(dist.toFixed(2)),
        services: filteredServices,
      });
    }

    // Optionally sort by price or distance
    enriched.sort((a, b) => a.distanceKm - b.distanceKm);

    res.json(enriched);
  } catch (err) {
    next(err);
  }
});

export default router;
