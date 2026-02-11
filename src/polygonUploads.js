import Polygon from "@arcgis/core/geometry/Polygon.js";
import SpatialReference from "@arcgis/core/geometry/SpatialReference.js";

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read the file."));
    reader.readAsText(file);
  });
}

function extractRingsFromGeometry(geometry) {
  if (!geometry) return [];

  switch (geometry.type) {
    case "Polygon":
      // coordinates[0] is exterior ring, coordinates[1+] are holes — keep only exterior
      return [geometry.coordinates[0]];

    case "MultiPolygon":
      // Each entry is a polygon: take only the exterior ring (index 0) from each
      return geometry.coordinates.map((poly) => poly[0]);

    case "Point":
    case "MultiPoint":
    case "LineString":
    case "MultiLineString":
    case "GeometryCollection":
      throw new Error(
        `Unsupported geometry type: ${geometry.type}. Only Polygon and MultiPolygon are accepted.`
      );

    default:
      throw new Error(`Unknown geometry type: ${geometry.type}.`);
  }
}

function extractPolygonRings(geojson) {
  if (!geojson || !geojson.type) {
    throw new Error("Invalid GeoJSON: missing 'type' property.");
  }

  switch (geojson.type) {
    case "FeatureCollection":
      if (!Array.isArray(geojson.features)) {
        throw new Error("Invalid FeatureCollection: missing 'features' array.");
      }
      return geojson.features.flatMap((feature) =>
        extractPolygonRings(feature)
      );

    case "Feature":
      return extractRingsFromGeometry(geojson.geometry);

    case "Polygon":
    case "MultiPolygon":
      return extractRingsFromGeometry(geojson);

    default:
      throw new Error(
        `Unsupported GeoJSON type: ${geojson.type}. Expected FeatureCollection, Feature, Polygon, or MultiPolygon.`
      );
  }
}

export async function parseGeoJSONFile(file) {
  const text = await readFileAsText(file);

  let geojson;
  try {
    geojson = JSON.parse(text);
  } catch {
    throw new Error(
      "Invalid JSON: the file could not be parsed. Please check the file format."
    );
  }

  const rings = extractPolygonRings(geojson);

  if (rings.length === 0) {
    throw new Error("No polygon geometries found in the uploaded file.");
  }

  const polygon = new Polygon({
    rings,
    spatialReference: SpatialReference.WGS84,
  });

  return {polygon};
}
