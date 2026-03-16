const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

export const chatSession = {
  async sendMessage(prompt: string) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        }),
      }
    );

    const data = await response.json();

    console.log("Gemini response:", data);

    return {
      response: {
        text: () =>
          data?.candidates?.[0]?.content?.parts?.[0]?.text || "",
      },
    };
  },
};