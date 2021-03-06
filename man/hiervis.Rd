% Generated by roxygen2: do not edit by hand
% Please edit documentation in R/hiervis.R
\name{hiervis}
\alias{hiervis}
\title{Create a hierarchical visualization from tabular data and data.frames}
\usage{
hiervis(data, vis = NULL, width = NULL, height = NULL,
  elementId = NULL, nameField = "name", valueField = "value",
  pathSep = NULL, parentField = NULL, stat = "count",
  vis.opts = list(transitionDuration = 350, showNumbers = TRUE,
  numberFormat = ",d", treeColors = TRUE, treemapHier = TRUE,
  sunburstLabelsRadiate = FALSE, circleNumberFormat = ".2s", linkColorChild
  = FALSE, sankeyMinHeight = NULL))
}
\arguments{
\item{data}{tabular data or data.frame}

\item{vis}{One of "sankey", "sunburst", "partition", "treemap".}

\item{width}{width of widget}

\item{height}{height of widget}

\item{elementId}{elementId}

\item{nameField}{field in data that has the name or ID}

\item{valueField}{field in data that has quantitative values}

\item{pathSep}{path separator in name field, e.g. "/"}

\item{parentField}{field in data that has the parent name or ID}

\item{stat}{a statistic to calculate the value, e.g. "count"}

\item{vis.opts}{additional parameters given to the javascript hiervis function}
}
\description{
This function can create a variety of interactive d3 visualizations from tables and
data.frames.
}
\details{
- tabular data can be used directly without extra arguments
- For data.frames or matrices with a path (e.g. "A/B/C"), specify
  nameField, pathSep and valueField
- For data.frames or matrices with parent and child fields, specify
  nameField and parentField
}
\examples{
data(Titanic)

## Tabular data does not need any extra arguments
hiervis(Titanic, "sankey")
hiervis(HairEyeColor, "vertical sankey")

## For data.frames with a path (e.g. A/B/C), supply nameField, pathSep and valueField
hiervis(d3_modules, "sunburst", nameField = "path", pathSep = "/", valueField = "size")

## For data.frames with parent and child field, supply nameField and parentField
data <- data.frame(name = c("Root Node", "Node A", "Node B", "Leaf Node A.1", "Leaf Node A.2"),
                   parent = c(NA, "Root Node", "Root Node", "Node A", "Node A"))
hiervis(data, "sankey", nameField = "name", parentField = "parent", stat = "count")
}
