# SOLID Checklist

## S - Single Responsibility
- [ ] Classes/Functions do one thing.
- [ ] Function is under 50 lines (rule of thumb).
- [ ] Module has high cohesion.

## O - Open/Closed
- [ ] Extension via inheritance, composition, or strategy pattern.
- [ ] No massive `switch` statements over types (use polymorphism).

## L - Liskov Substitution
- [ ] Subtypes can stand in for base types without breaking.
- [ ] No "not implemented" exceptions in subclasses.

## I - Interface Segregation
- [ ] Clients shouldn't be forced to depend on methods they don't use.
- [ ] Small, focused interfaces/types.

## D - Dependency Inversion
- [ ] Depend on abstractions, not concretions.
- [ ] Use Dependency Injection where appropriate.
- [ ] High-level modules don't depend on low-level modules.
