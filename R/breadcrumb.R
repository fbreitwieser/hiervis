#' Breadcrumbs!
#'
#' @export
breadcrumb <- function(data, width = NULL, height = "50px", elementId = NULL,
    opts = list(
    padding = 5, width = 130, height = 28, top = 10,
    fontSize = 12, marginLeft = 0, marginTop = 10,
    leftDirection = FALSE, wrapWidth = 0)) {

  # create widget
  htmlwidgets::createWidget(
    name = 'breadcrumb',
    list(
      data = data,
      opts = opts
    ),
    width = width,
    height = height,
    package = 'hiervis',
    elementId = elementId,
    dependencies = list(d3r::d3_dep_v4(), breadcrumb_dep())
  )
}

#' @keywords internal
breadcrumb_dep <- function() {
  htmltools::htmlDependency(
    name = "breadcrumb",
    version = "0.1",
    src = c(
      file = system.file("d3-hiervis/src", package="hiervis")
    ),
    script = c("breadcrumb.js")
    #stylesheet = "d2b_custom.css"
  )
}


#' Shiny bindings for breadcrumb
#'
#' Output and render functions for using breadcrumb within Shiny
#' applications and interactive Rmd documents.
#'
#' @param outputId output variable to read from
#' @param width,height Must be a valid CSS unit (like \code{'100\%'},
#'   \code{'400px'}, \code{'auto'}) or a number, which will be coerced to a
#'   string and have \code{'px'} appended.
#' @param expr An expression that generates a breadcrumb
#' @param env The environment in which to evaluate \code{expr}.
#' @param quoted Is \code{expr} a quoted expression (with \code{quote()})? This
#'   is useful if you want to save an expression in a variable.
#'
#' @name breadcrumb-shiny
#'
#' @export
breadcrumbOutput <- function(outputId, width = '100%', height = '50px'){
  htmlwidgets::shinyWidgetOutput(outputId, 'breadcrumb', width, height, package = 'hiervis')
}

#' @rdname breadcrumb-shiny
#' @export
renderBreadcrumb <- function(expr, env = parent.frame(), quoted = FALSE) {
  if (!quoted) { expr <- substitute(expr) } # force quoted
  htmlwidgets::shinyRenderWidget(expr, breadcrumbOutput, env, quoted = TRUE)
}
