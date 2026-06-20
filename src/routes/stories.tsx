import { createFileRoute } from "@tanstack/react-router";
import { Star } from "lucide-react";

export const Route = createFileRoute("/stories")({
  head: () => ({
    meta: [
      { title: "Success Stories — SRGYM" },
      { name: "description", content: "Real transformations from members of SRGYM AND FITNESS CENTRE." },
      { property: "og:title", content: "SRGYM Success Stories" },
      { property: "og:description", content: "Real members. Real results." },
    ],
  }),
  component: Stories,
});

// Google reviews copied from the prompt (names/quotes). Reviews don’t consistently include a “role/metric” field,
// so `role` is used for the reviewer context like time/review-count or a short label.
const stories = [
  {
    name: "Sriharish. S",
    role: "member",
    quote: "Great gym with excellent trainers and a motivating atmosphere. The equipment is well-maintained, and the staff is very supportive. Highly recommended for anyone serious about fitness!",
  },
  {
    name: "Balaji G",
    role: "member",
    quote:
      "Great gym with good equipment and a clean environment. The trainers are friendly, supportive, and always ready to help. The atmosphere is motivating, making workouts enjoyable. Highly recommended for anyone looking to improve their fitness.",
  },
  {
    name: "Sarmila v",
    role: "member",
    quote:
      "Nice gym, Trainer are Friendly and professional!!!!! highly recommendation. Excellent Trainer, welcoming atmosphere, inclusive of all body types, ages and abilities. If you are committed to making fitness it is right place...more Affordable women and for all....",
  },
  {
    name: "Vijayan V",
    role: "Local Guide",
    quote:
      "Good gym with necessary accessories with affordable price.",
  },
  
  {
    name: "Purushotham J",
    role: "member",
    quote:
      "Amazing gym with excellent equipment, motivating trainers, and a great workout environment. The boxing training is a huge plus and adds a fun way to stay fit. Clean facility, supportive staff, and a positive atmosphere. Highly recommend SR Gym & Fitness Centre to anyone looking to improve their fitness and health!",
  },
  {
    name: "Fahim Ckf",
    role: "member",
    quote:
      "They have experienced trainers and low cost fees superb I love it",
  },
  
  {
    name: "Abishek",
    role: "6 reviews • a year ago",
    quote:
      "A place where you kick off all your stress and make your strength 📈 to maximize... Master is very friendly",
  },
  {
    name: "Bala Hari",
    role: "3 reviews • 4 years ago",
    quote:
      "Good environment within the Gym with Motivating vibe. Equipments are new and extremely perfect to use. Trainers are fully co operative. Worth enough for me to workout. Affordable too...",
  },
  {
    name: "mohanapriya.s subramani.a",
    role: "4 reviews • 4 years ago",
    quote:
      "Iam extremmely glad to have chosen SR Gym, as it is not just a Gym but its a Healthy Family Member for all. Eventhough in pandemic lockdown situation, they are not stopped from our healthy workouts by giving online workout sessions...",
  },
    ];

  function Stories() {
    return (
      <div>
        <section className="border-b border-border/50 bg-gradient-dark py-20">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Stories</p>
            <h1 className="mt-3 font-display text-5xl font-extrabold sm:text-6xl">
            Real members. <span className="text-gradient-red">Real results.</span>
          </h1>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 md:grid-cols-2 lg:grid-cols-3">
          {stories.map((s) => (
            <figure key={s.name} className="glass rounded-2xl p-6">
              <div className="flex gap-1 text-primary">
                {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
              </div>
              <blockquote className="mt-4 text-sm text-foreground/90">"{s.quote}"</blockquote>
              <figcaption className="mt-5 border-t border-border pt-4">
                <div className="font-semibold">{s.name}</div>
                <div className="text-xs text-primary">{s.role}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </div>
  );
}
