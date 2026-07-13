import { describe, expect, it } from "vitest"
import { collectUploadRefs } from "@rahoot/socket/utils/collect-media-refs"

describe("collectUploadRefs", () => {
  it("collecte les références /uploads/ de tous les champs porteurs de média d'un quiz", () => {
    const quizz = {
      subject: "Test",
      salonImage: "/uploads/salon.webp",
      listingImage: "/uploads/listing.webp",
      questions: [
        {
          type: "mcq",
          question: "Q1",
          media: { type: "image", url: "/uploads/media1.webp" },
          audio: "/uploads/sound1.mp3",
          background: { type: "image", value: "/uploads/bg1.webp" },
          answerReveal: { enabled: true, image: "/uploads/reveal1.webp" },
          elements: [
            { id: "e1", type: "image", url: "/uploads/element1.webp" },
            { id: "e2", type: "text", text: "salut", fill: "#ffffff" },
          ],
        },
        {
          type: "image_sequence",
          question: "Q2",
          images: ["/uploads/seq1.webp", "/uploads/seq2.webp"],
        },
        {
          type: "drop_pin",
          question: "Q3",
          pinImage: "/uploads/pin1.webp",
        },
      ],
    }

    expect(collectUploadRefs(quizz)).toEqual(
      new Set([
        "salon.webp",
        "listing.webp",
        "media1.webp",
        "sound1.mp3",
        "bg1.webp",
        "reveal1.webp",
        "element1.webp",
        "seq1.webp",
        "seq2.webp",
        "pin1.webp",
      ]),
    )
  })

  it("retourne un set vide pour un quiz sans média local", () => {
    const quizz = {
      subject: "X",
      questions: [
        { type: "mcq", question: "Q", answers: ["a", "b"], solutions: [0] },
      ],
    }

    expect(collectUploadRefs(quizz)).toEqual(new Set())
  })

  it("ignore les URLs externes (Unsplash/Giphy) et ne garde que /uploads/", () => {
    const quizz = {
      subject: "X",
      salonImage: "https://images.unsplash.com/photo-123",
      questions: [
        {
          type: "mcq",
          question: "Q",
          media: { type: "image", url: "https://media.giphy.com/x.gif" },
        },
      ],
    }

    expect(collectUploadRefs(quizz)).toEqual(new Set())
  })

  it("extrait le nom de fichier en présence d'une query string ou d'un fragment", () => {
    expect(collectUploadRefs("/uploads/img-42.webp?v=2")).toEqual(
      new Set(["img-42.webp"]),
    )
    expect(collectUploadRefs("/uploads/img-7.gif#frag")).toEqual(
      new Set(["img-7.gif"]),
    )
  })
})
