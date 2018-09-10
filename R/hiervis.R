#' Create a hierarchical visualization
#'
#' <Add Description>
#'
#' @param vis One of "sankey", "sunburst", "partition", "treemap"
#' @param opts
#'    {valueField: "size", stat: "sum", pathField: "path", pathSep: "/"});
#' @import htmlwidgets
#'
#' @export
hiervis <- function(vis, data, width = NULL, height = NULL, elementId = NULL,
                    opts = list(pathField="path", valueField="size", pathSep="/", stat="sum")) {

  # forward options using x
  x = list(
    vis = vis,
    data = dataframeToD3(data),
    opts = opts
  )

  # create widget
  htmlwidgets::createWidget(
    name = 'hiervis',
    x,
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
hiervis_html <- function(id, style, class, ...){
  htmltools::tags$div(
    id = id, class = class, style = style,
    htmltools::tags$div(
      class = "btn-group zoom-menu",
      htmltools::tags$button(
        type = "button",
        class = "btn btn-default btn-lg zoom-in",
        title = "Zoom in",
        "+"
      ),
      htmltools::tags$button(
        type = "button",
        class = "btn btn-default btn-lg zoom-out",
        title = "Zoom out",
        "-"
      )
    )
  )
}
