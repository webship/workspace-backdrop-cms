Feature: An editor writes a post and removes it again
  As an editor
  I want to write, change, publish and delete a post
  So that the suite proves the content form works and leaves the site as it found it

  # Each scenario starts by making sure its own title is not on the site, so a run that failed
  # half way does not break the next one.

  Scenario: The editor creates, edits and deletes a post
    Given I am logged in as "editor"
    And the content "A post written by a scenario" does not exist
    And the content "A post changed by a scenario" does not exist
    When I start a new "Post"
    Then the page heading should be "Create Post"
    When I enter "A post written by a scenario" in the "Title" field
    And I write "<p>This post is written and removed by the suite.</p>" in the "Body" editor
    And I save the content form
    Then the status message should be "Post A post written by a scenario has been created."
    And I should see "This post is written and removed by the suite."
    And the content on the page should be published
    When I open the "Edit" page tab
    And I enter "A post changed by a scenario" in the "Title" field
    And I save the content form
    Then the status message should contain "has been updated."
    And the page heading should be "A post changed by a scenario"
    When I delete the content "A post changed by a scenario"
    Then the status message should contain "has been deleted."
    And the content "A post changed by a scenario" should not exist

  Scenario: A post is saved as a draft, then published
    Given I am logged in as "editor"
    And the content "A draft written by a scenario" does not exist
    When I start a new "Post"
    And I enter "A draft written by a scenario" in the "Title" field
    And I set the content to be a draft
    And I save the content form
    Then the content on the page should be unpublished
    And the content "A draft written by a scenario" should have the status "Not published"
    When I edit the content "A draft written by a scenario"
    And I set the content to be published
    And I save the content form
    Then the content "A draft written by a scenario" should have the status "Published"
    When I delete the content "A draft written by a scenario"
    Then the content "A draft written by a scenario" should not exist
