type QuokkaRequest = {
  script?: unknown;
  count?: unknown;
  quokkaName?: unknown;
  qubitCount?: unknown;
};

export const onRequestPost: PagesFunction = async ({ request }) => {
  let body: QuokkaRequest;
  try {
    body = (await request.json()) as QuokkaRequest;
  } catch {
    return json({ error: "Request body must be JSON." }, 400);
  }

  const script = body.script;
  const count = body.count;
  const quokkaName =
    typeof body.quokkaName === "string" && body.quokkaName.trim()
      ? body.quokkaName.trim()
      : "quokka1";
  const qubitCount = body.qubitCount;

  if (typeof script !== "string" || script.trim().length === 0) {
    return json({ error: "script must be a non-empty QASM string." }, 400);
  }
  if (!Number.isInteger(count) || Number(count) <= 0 || Number(count) > 5000) {
    return json({ error: "count must be a positive integer no greater than 5000." }, 400);
  }
  if (qubitCount !== 1 && qubitCount !== 2) {
    return json({ error: "qubitCount must be 1 or 2." }, 400);
  }
  if (!/^[a-zA-Z0-9-]+$/.test(quokkaName)) {
    return json({ error: "quokkaName contains unsupported characters." }, 400);
  }

  try {
    const response = await fetch(`https://${quokkaName}.quokkacomputing.com/qsim/qasm`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ script, count }),
    });

    const text = await response.text();
    let payload: unknown;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { message: text };
    }

    if (!response.ok) {
      const message =
        typeof payload === "object" && payload !== null && "message" in payload
          ? String((payload as { message: unknown }).message)
          : `Quokka returned HTTP ${response.status}.`;
      return json({ error: message }, response.status);
    }

    return json({ measurements: extractMeasurements(payload, qubitCount) });
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error
            ? `Quokka request failed: ${error.message}`
            : "Quokka request failed.",
      },
      502,
    );
  }
};

export const onRequest: PagesFunction = async () =>
  json({ error: "Method not allowed. Use POST." }, 405);

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json",
    },
  });
}

function extractMeasurements(payload: unknown, qubitCount: 1 | 2): Array<number | number[]> {
  if (!isRecord(payload)) {
    throw new Error("Unexpected Quokka response payload.");
  }
  const result = payload.result;
  if (isRecord(result) && "c" in result) {
    return normalizeMeasurements(result.c, qubitCount);
  }
  if ("c" in payload) {
    return normalizeMeasurements(payload.c, qubitCount);
  }
  const data = payload.data;
  if (isRecord(data) && "c" in data) {
    return normalizeMeasurements(data.c, qubitCount);
  }
  throw new Error("Unexpected Quokka response payload.");
}

function normalizeMeasurements(rawMeasurements: unknown, qubitCount: 1 | 2): Array<number | number[]> {
  if (!Array.isArray(rawMeasurements)) {
    throw new Error("Unexpected Quokka result type.");
  }
  return rawMeasurements.map((measurement) => normalizeMeasurementValue(measurement, qubitCount));
}

function normalizeMeasurementValue(rawValue: unknown, qubitCount: 1 | 2): number | number[] {
  if (typeof rawValue === "number" && Number.isInteger(rawValue)) {
    if (rawValue < 0 || rawValue >= 2 ** qubitCount) {
      throw new Error(`Unexpected measurement value: ${rawValue}`);
    }
    if (qubitCount === 1) {
      return rawValue;
    }
    return Array.from({ length: qubitCount }, (_, qubit) => (rawValue >> (qubitCount - qubit - 1)) & 1);
  }
  if (
    Array.isArray(rawValue) &&
    rawValue.length === qubitCount &&
    rawValue.every((bit) => Number.isInteger(bit) && (bit === 0 || bit === 1))
  ) {
    return qubitCount === 1 ? rawValue[0] : rawValue;
  }
  throw new Error(`Unexpected measurement value: ${JSON.stringify(rawValue)}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
