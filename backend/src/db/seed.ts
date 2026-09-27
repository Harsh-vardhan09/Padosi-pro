import 'dotenv/config';
import { prisma } from './prisma.js';

const catalogue: { category: string; tasks: [name: string, description: string][] }[] = [
  {
    category: 'Errands & Daily Tasks',
    tasks: [
      ['Grocery Runs', 'We shop your weekly list and drop it at your door.'],
      ['Pharmacy Pickup', 'We collect prescriptions and medicines from your chemist.'],
      ['Courier Drop-off', 'We pack and send your parcels so you skip the queue.'],
      ['Utility Bill Payments', 'We pay electricity, water and gas bills before they lapse.'],
      ['Laundry & Dry Cleaning', 'We hand over your clothes and bring them back folded.'],
    ],
  },
  {
    category: 'Home Services',
    tasks: [
      ['AC Service & Repair', 'We book a vetted technician and supervise the visit.'],
      ['Plumbing Repairs', 'We arrange a plumber for leaks, taps and blocked drains.'],
      ['Deep Cleaning', 'We schedule a full-home clean and inspect the work after.'],
      ['Pest Control', 'We organise the treatment and the follow-up visit.'],
      ['Electrical Repairs', 'We send an electrician for fittings, fans and wiring faults.'],
    ],
  },
  {
    category: 'Travel & Tourism',
    tasks: [
      ['Airport Transfers', 'We arrange a driver and watch your flight timing.'],
      ['Hotel Bookings', 'We compare options and confirm a stay within your budget.'],
      ['Passport Assistance', 'We prepare the paperwork and book your appointment slot.'],
      ['Flight & Train Tickets', 'We find the route you want and hold the booking.'],
      ['Visa Paperwork', 'We assemble documents and work through the checklist for you.'],
    ],
  },
  {
    category: 'Health & Medical',
    tasks: [
      ['Doctor Appointments', 'We find a specialist and book a slot that suits you.'],
      ['Physiotherapy Sessions', 'We arrange a therapist to visit at a fixed weekly time.'],
      ['Lab Tests at Home', 'We schedule sample collection and chase the report.'],
      ['Medicine Refills', 'We keep repeat prescriptions stocked every month.'],
      ['Health Insurance Claims', 'We compile the forms and follow up until the claim settles.'],
    ],
  },
  {
    category: 'Senior Care',
    tasks: [
      ['Elderly Companionship', 'A familiar visitor drops in for conversation and small errands.'],
      ['Hospital Visit Escort', 'We accompany your parents through appointments start to finish.'],
      ['Daily Check-in Calls', 'We call every day and report back to you.'],
      ['Pension & Bank Paperwork', 'We handle forms, KYC and branch visits on their behalf.'],
    ],
  },
  {
    category: 'Digital & Tech Help',
    tasks: [
      ['Phone & Laptop Setup', 'We configure a new device and move your data across.'],
      ['Wi-Fi Troubleshooting', 'We diagnose slow internet and deal with the provider.'],
      ['Online Form Filling', 'We complete the applications and portals you would rather avoid.'],
      ['Device Repair Coordination', 'We take the device in for service and bring it back.'],
    ],
  },
];

async function seed(): Promise<void> {
  for (const [index, entry] of catalogue.entries()) {
    const sortOrder = index + 1;

    // upsert rather than create: re-running the seed updates the catalogue instead of failing.
    const category = await prisma.taskCategory.upsert({
      where: { name: entry.category },
      create: { name: entry.category, sortOrder },
      update: { sortOrder },
    });

    for (const [name, description] of entry.tasks) {
      await prisma.task.upsert({
        where: { categoryId_name: { categoryId: category.id, name } },
        create: { categoryId: category.id, name, description },
        update: { description },
      });
    }
  }

  const [categories, tasks] = await Promise.all([
    prisma.taskCategory.count(),
    prisma.task.count(),
  ]);
  console.log(`seeded ${categories} categories and ${tasks} tasks`);
}

try {
  await seed();
} finally {
  await prisma.$disconnect();
}
