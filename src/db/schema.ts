import { pgTable, serial, varchar, text, real, timestamp, boolean, integer } from "drizzle-orm/pg-core";

export const diagnoses = pgTable("diagnoses", {
  id: serial("id").primaryKey(),
  patientId: varchar("patient_id", { length: 64 }),
  patientName: varchar("patient_name", { length: 128 }),
  label: varchar("label", { length: 32 }).notNull(),
  probability: real("probability").notNull(),
  confidence: real("confidence").notNull(),
  heatmapBase64: text("heatmap_base64"),
  imageMimeType: varchar("image_mime_type", { length: 64 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const modelMetrics = pgTable("model_metrics", {
  id: serial("id").primaryKey(),
  metricName: varchar("metric_name", { length: 64 }).notNull(),
  metricValue: real("metric_value").notNull(),
  split: varchar("split", { length: 32 }).notNull(), // train / val / test
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const datasetStats = pgTable("dataset_stats", {
  id: serial("id").primaryKey(),
  split: varchar("split", { length: 32 }).notNull(),
  classLabel: varchar("class_label", { length: 32 }).notNull(),
  count: integer("count").notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});
