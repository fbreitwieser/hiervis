#' Create a hierarchical visualization
#'
#' Creates hierarchical visualizations based on data frame.
#'
#' @param data data.frame containing
#' @param width Width of SVG element.
#' @param height Height of SVG element.
#' @param elementId
#' @param nameField
#' @param valueField
#' @param pathSep If pathSep is supplied, consider the nameField to be a path.
#' @param parentField
#' @param stat
#' @param vis One of "sankey", "sunburst", "partition", "treemap"
#'
#' @import htmlwidgets
#'
#' @export
#' @examples
#' data(Titanic)
#'
#' ## Tabular data does not need any extra arguments
#' hiervis(Titanic, "sankey")
#' hiervis(HairEyeColor, "vertical sankey")
#'
#' ## For tabular data (data.frames) with a path, supply nameField, pathSep and valueField
#' hiervis(d3_modules, "sunburst", nameField = "path", pathSep = "/", valueField = "size")
#'
#' ## For tabular data (data.frames) with parent-child information, supply nameField and parentField
#' data <- data.frame(name = c("Root Node", "Node A", "Node B", "Leaf Node A.1", "Leaf Node A.2"), parent = c(NA, "Root Node", "Root Node", "Node A", "Node A"))
#' hiervis(data, "sankey", nameField = "name", parentField = "parent", stat = "count")
hiervis <- function(data, vis = NULL, width = NULL, height = NULL, elementId = NULL,
                    nameField = "name", valueField = "value",
                    pathSep = NULL, parentField = NULL, stat = "count") {

  if (is.null(vis)) {
    message("vis parameter empty - displaying 'sankey'")
    vis <- "sankey"
  }

  if (is.table(data)) {
    data <- d3r::d3_nest(data.frame(data), value_cols = "Freq")
    pathSep <- NULL
    parentField <- NULL
    valueField <- "Freq"
    stat <- "sum"
  } else if (is.data.frame(data)) {
    if ((is.null(pathSep) && is.null(parentField)) || (!is.null(pathSep) && !is.null(parentField))) {
      stop("Specify either pathSep (+nameField) or parentField when supplying a data.frame!")
    }
    data = dataframeToD3(data)
  } else {
    stop("Do not know how to deal with data of class ", class(data))
  }

  options <- list (nameField = nameField, valueField = valueField,
                   pathSep = pathSep, parentField = parentField,
                   stat = stat)

  # create widget
  htmlwidgets::createWidget(
    name = 'hiervis',
    list(
      data = data,
      vis = vis,
      opts = options
    ),
    width = width,
    height = height,
    package = 'hiervis',
    elementId = elementId,
    dependencies = list(d3r::d3_dep_v4(), hiervis_dep())
  )
}

#' from Dean Attali
#' @keywords internal
dataframeToD3 <- function(df) {
  if (missing(df) || is.null(df)) {
    return(list())
  }
  if (!is.data.frame(df)) {
    stop("timevis: the input must be a dataframe", call. = FALSE)
  }

  row.names(df) <- NULL
  apply(df, 1, function(row) as.list(row[!is.na(row)]))
}


#' @keywords internal
hiervis_dep <- function() {
  htmltools::htmlDependency(
    name = "hiervis",
    version = "0.1",
    src = c(
      file = system.file("d3-hiervis/src", package="hiervis")
    ),
    script = c("hiervis.js", "TreeColors.js")
    #stylesheet = "d2b_custom.css"
  )
}


#' Shiny bindings for hiervis
#'
#' Output and render functions for using hiervis within Shiny
#' applications and interactive Rmd documents.
#'
#' @param outputId output variable to read from
#' @param width,height Must be a valid CSS unit (like \code{'100\%'},
#'   \code{'400px'}, \code{'auto'}) or a number, which will be coerced to a
#'   string and have \code{'px'} appended.
#' @param expr An expression that generates a hiervis
#' @param env The environment in which to evaluate \code{expr}.
#' @param quoted Is \code{expr} a quoted expression (with \code{quote()})? This
#'   is useful if you want to save an expression in a variable.
#'
#' @name hiervis-shiny
#'
#' @export
hiervisOutput <- function(outputId, width = '100%', height = '400px'){
  htmlwidgets::shinyWidgetOutput(outputId, 'hiervis', width, height, package = 'hiervis')
}

#' @rdname hiervis-shiny
#' @export
renderHiervis <- function(expr, env = parent.frame(), quoted = FALSE) {
  if (!quoted) { expr <- substitute(expr) } # force quoted
  htmlwidgets::shinyRenderWidget(expr, hiervisOutput, env, quoted = TRUE)
}

# Add custom HTML to wrap the widget to allow for buttons
# hiervis_html <- function(id, style, class, ...){
#   htmltools::tags$div(
#     id = id, class = class, style = style,
#     htmltools::tags$div(
#       class = "btn-group zoom-menu",
#       htmltools::tags$button(
#         type = "button",
#         class = "btn btn-default btn-lg zoom-in",
#         title = "Zoom in",
#         "+"
#       ),
#       htmltools::tags$button(
#         type = "button",
#         class = "btn btn-default btn-lg zoom-out",
#         title = "Zoom out",
#         "-"
#       )
#     )
#   )
# }
